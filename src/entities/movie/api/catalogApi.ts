import {
  apiClient,
  asQueryError,
  baseApi,
  runQuery,
  unwrapErrorDto,
} from '@shared/api'

import type { Movie, PopularMovie } from '../model/types'
import { mapDocToMovie } from './mapDocToMovie'
import { MAX_PAGES, PER_PAGE } from './paginationConfig'
import type {
  CatalogPageResult,
  CatalogParams,
  PopularMoviesParams,
} from './types'

// query, по которому получены данные: при смене аргументов хук держит прежние data, и режим
// (поиск/каталог) для них нужно брать отсюда, а не из живого query.
type CatalogResult = CatalogPageResult & { query: string }

// Аргумент getCatalog: непустой query → текстовый поиск (params игнорируются — API не
// сочетает текст с фильтрами), пустой → каталог по params с эмуляцией numbered-page.
type CatalogArgs = {
  query: string
  params?: CatalogParams
  page: number
}

type CursorStepArgs = {
  params: CatalogParams
  cursor?: string
}

type CursorStepResult = {
  movies: Movie[]
  next: string | null
  total: number | null
}

// Поля карточки фильма в запросах /v1.5/movie: без постера и рейтинга карточка пустая,
// selectFields — ровно то, что читает mapDocToMovie.
const MOVIE_CARD_QUERY = {
  notNullFields: ['poster.url', 'rating.kp', 'rating.imdb'],
  selectFields: [
    'id',
    'name',
    'year',
    'rating',
    'type',
    'genres',
    'movieLength',
    'poster',
  ],
} satisfies NonNullable<CatalogParams>

export const movieListApi = baseApi.injectEndpoints({
  endpoints: build => ({
    // Один шаг курсора /v1.5/movie. Отдельный endpoint, чтобы шаги кешировались по
    // (params, cursor): переход на страницу N+1 после N стоит одного запроса, а не N+1.
    getCatalogCursorStep: build.query<CursorStepResult, CursorStepArgs>({
      queryFn: ({ params, cursor }) =>
        runQuery(async () => {
          const response = await apiClient.getV15Movie({
            query: {
              ...params,
              ...MOVIE_CARD_QUERY,
              limit: PER_PAGE,
              next: cursor,
              // total нужен только с первого шага курсора (от шага к шагу он не меняется)
              withCount: cursor === undefined,
            },
          })

          if (!('docs' in response.data)) {
            return { movies: [], next: null, total: null }
          }

          return {
            movies: response.data.docs.map(mapDocToMovie),
            next: response.data.next ?? null,
            total: response.data.total ?? null,
          }
        }),
    }),
    getSearchMovies: build.query<
      CatalogPageResult,
      { query: string; page: number }
    >({
      queryFn: ({ query, page }) =>
        runQuery(async () => {
          const response = await apiClient.getV15MovieSearch({
            query: { query, page, limit: PER_PAGE },
          })

          if (!('docs' in response.data)) {
            return { movies: [], totalPages: 0 }
          }

          return {
            movies: response.data.docs.map(mapDocToMovie),
            totalPages: Math.min(MAX_PAGES, response.data.pages),
          }
        }),
    }),
    getMovies: build.query<Movie[], CatalogParams>({
      queryFn: params =>
        runQuery(async () => {
          const response = await apiClient.getV15Movie({
            query: { ...params, ...MOVIE_CARD_QUERY },
          })

          if (!('docs' in response.data)) return []

          return response.data.docs.map(mapDocToMovie)
        }),
    }),
    getPopularMovies: build.query<PopularMovie[], PopularMoviesParams>({
      queryFn: params =>
        runQuery(async () => {
          const response = await apiClient.getV15ListBySlug({
            path: { slug: params.slug },
            query: { limit: params.limit },
          })

          return unwrapErrorDto(response.data).movies.docs.map(item => ({
            ...mapDocToMovie(item.movie),
            position: item.position,
            positionDiff: item.positionDiff,
          }))
        }),
    }),
  }),
})

const toTotalPages = (total: number | null): number => {
  // total недоступен (withCount не отработал) — не режем пагинацию, отдаём потолок demo-тарифа
  if (total === null) {
    return MAX_PAGES
  }

  return Math.min(MAX_PAGES, Math.ceil(total / PER_PAGE))
}

// Отдельный injectEndpoints: queryFn ссылается на movieListApi.endpoints, а внутри самого
// инициализатора movieListApi это дало бы циклический вывод типов.
export const moviePageApi = baseApi.injectEndpoints({
  endpoints: build => ({
    // API каталога курсорный, numbered-страницы эмулируются обходом next 1..page. Каждый шаг
    // берётся через initiate — из кеша getCatalogCursorStep, если уже пройден.
    getMoviesPage: build.query<
      CatalogPageResult,
      { params: CatalogParams; page: number }
    >({
      queryFn: async ({ params, page }, { dispatch }) => {
        const fetchStep = (cursor?: string) =>
          dispatch(
            movieListApi.endpoints.getCatalogCursorStep.initiate(
              { params, cursor },
              { subscribe: false },
            ),
          ).unwrap()

        try {
          let cursor: string | undefined
          let total: number | null = null

          for (let current = 1; ; current += 1) {
            const step = await fetchStep(cursor)

            if (current === 1) {
              total = step.total
            }

            if (current >= page) {
              return {
                data: { movies: step.movies, totalPages: toTotalPages(total) },
              }
            }

            if (!step.next) {
              // курсор закончился раньше целевой страницы — пустой хвост
              return { data: { movies: [], totalPages: toTotalPages(total) } }
            }

            cursor = step.next
          }
        } catch (error) {
          return { error: asQueryError(error) }
        }
      },
    }),
  }),
})

// Отдельный injectEndpoints по той же причине: queryFn ссылается на moviePageApi.
export const catalogApi = baseApi.injectEndpoints({
  endpoints: build => ({
    // Единый endpoint /search: один хук на оба режима, поэтому при переключении поиск ↔
    // каталог data держит прежнюю сетку, а не проваливается в скелетон (как было бы с двумя
    // хуками и skip). Сам ничего не запрашивает — делегирует в кеш нижних endpoints.
    getCatalog: build.query<CatalogResult, CatalogArgs>({
      queryFn: async ({ query, params, page }, { dispatch }) => {
        try {
          const data = query
            ? await dispatch(
                movieListApi.endpoints.getSearchMovies.initiate(
                  { query, page },
                  { subscribe: false },
                ),
              ).unwrap()
            : await dispatch(
                moviePageApi.endpoints.getMoviesPage.initiate(
                  { params, page },
                  { subscribe: false },
                ),
              ).unwrap()

          return { data: { ...data, query } }
        } catch (error) {
          return { error: asQueryError(error) }
        }
      },
    }),
  }),
})

export const { useGetMoviesQuery, useGetPopularMoviesQuery } = movieListApi
export const { useGetCatalogQuery } = catalogApi
