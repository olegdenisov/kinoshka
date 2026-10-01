import {
  apiClient,
  baseApi,
  toQueryError,
  type QueryError,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'

import type { Movie, MovieDetail, PopularMovie } from '../model/types'
import {
  countryDictionaryCache,
  genreDictionaryCache,
  type DictionaryCache,
} from './createDictionaryCache'
import { mapDocToMovie } from './mapDocToMovie'
import { mapDtoToMovieDetail } from './mapDtoToMovieDetail'
import { MAX_PAGES, PER_PAGE } from './paginationConfig'

export type MoviesParams = MovieControllerFindManyByQueryV15Data['query']
export type CatalogParams = MoviesParams

export type CatalogPageResult = {
  movies: Movie[]
  totalPages: number
}

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
export type PopularMoviesParams = { slug: string; limit: number }

export type MovieImage = {
  url: string
  previewUrl?: string
}

// queryFn справочника: кулдаун проверяется здесь, а не в хуке — RTK Query сам перезапускает
// упавший запрос на новой подписке, и только queryFn видит каждую такую попытку.
const fetchDictionary = async (
  type: 'genres' | 'countries',
  cache: DictionaryCache,
): Promise<{ data: string[] } | { error: QueryError }> => {
  if (!cache.tryStartAttempt()) {
    return { error: { message: 'Dictionary refresh is cooling down' } }
  }

  try {
    const response = await apiClient.getV15DictionaryByType({ path: { type } })

    if ('statusCode' in response.data) {
      // нужно чтобы сузить тип
      return {
        error: {
          status: response.data.statusCode,
          message: response.data.message,
        },
      }
    }

    return { data: response.data.items.map(item => item.name) }
  } catch (error) {
    return { error: toQueryError(error) }
  }
}

// Успешный ответ переживает перезагрузку через localStorage-слот; ошибка слот не трогает.
const persistDictionary =
  (cache: DictionaryCache) =>
  async (
    _arg: void,
    { queryFulfilled }: { queryFulfilled: Promise<{ data: string[] }> },
  ) => {
    try {
      const { data } = await queryFulfilled
      cache.save(data)
    } catch {
      // ошибка уже лежит в стейте запроса; существующий кеш остаётся как есть
    }
  }

export const movieApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getGenreDictionary: build.query<string[], void>({
      queryFn: () => fetchDictionary('genres', genreDictionaryCache),
      onQueryStarted: persistDictionary(genreDictionaryCache),
    }),
    getCountryDictionary: build.query<string[], void>({
      queryFn: () => fetchDictionary('countries', countryDictionaryCache),
      onQueryStarted: persistDictionary(countryDictionaryCache),
    }),
    getMovieDetail: build.query<MovieDetail, number>({
      queryFn: async id => {
        try {
          const response = await apiClient.getV15MovieById({ path: { id } })

          if ('statusCode' in response.data) {
            // нужно чтобы сузить тип
            return {
              error: {
                status: response.data.statusCode,
                message: response.data.message,
              },
            }
          }

          return { data: mapDtoToMovieDetail(response.data) }
        } catch (error) {
          return { error: toQueryError(error) }
        }
      },
    }),
    getMovieImages: build.query<MovieImage[], number>({
      queryFn: async id => {
        try {
          const response = await apiClient.getV15Image({
            query: {
              movieId: [String(id)],
              type: ['frame', 'screenshot'],
              limit: 8,
              selectFields: ['url', 'previewUrl'],
            },
          })

          if (!('docs' in response.data)) {
            // нужно чтобы сузить тип
            return { data: [] }
          }

          return {
            data: response.data.docs
              .filter(
                (image): image is typeof image & { url: string } => !!image.url,
              )
              .map(image => ({
                url: image.url,
                previewUrl: image.previewUrl ?? undefined,
              })),
          }
        } catch (error) {
          return { error: toQueryError(error) }
        }
      },
    }),
    // Один шаг курсора /v1.5/movie. Отдельный endpoint, чтобы шаги кешировались по
    // (params, cursor): переход на страницу N+1 после N стоит одного запроса, а не N+1.
    getCatalogCursorStep: build.query<CursorStepResult, CursorStepArgs>({
      queryFn: async ({ params, cursor }) => {
        try {
          const response = await apiClient.getV15Movie({
            query: {
              ...params,
              limit: PER_PAGE,
              next: cursor,
              // total нужен только с первого шага курсора (от шага к шагу он не меняется)
              withCount: cursor === undefined,
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
            },
          })

          if (!('docs' in response.data)) {
            return { data: { movies: [], next: null, total: null } }
          }

          return {
            data: {
              movies: response.data.docs.map(mapDocToMovie),
              next: response.data.next ?? null,
              total: response.data.total ?? null,
            },
          }
        } catch (error) {
          return { error: toQueryError(error) }
        }
      },
    }),
    getSearchMovies: build.query<
      CatalogPageResult,
      { query: string; page: number }
    >({
      queryFn: async ({ query, page }) => {
        try {
          const response = await apiClient.getV15MovieSearch({
            query: { query, page, limit: PER_PAGE },
          })

          if (!('docs' in response.data)) {
            return { data: { movies: [], totalPages: 0 } }
          }

          return {
            data: {
              movies: response.data.docs.map(mapDocToMovie),
              totalPages: Math.min(MAX_PAGES, response.data.pages),
            },
          }
        } catch (error) {
          return { error: toQueryError(error) }
        }
      },
    }),
    getMovies: build.query<Movie[], MoviesParams>({
      queryFn: async params => {
        try {
          const response = await apiClient.getV15Movie({
            query: {
              ...params,
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
            },
          })

          if (!('docs' in response.data)) {
            // нужно чтобы сузить тип
            return { data: [] }
          }

          return { data: response.data.docs.map(mapDocToMovie) }
        } catch (error) {
          return { error: toQueryError(error) }
        }
      },
    }),
    getPopularMovies: build.query<PopularMovie[], PopularMoviesParams>({
      queryFn: async params => {
        try {
          const response = await apiClient.getV15ListBySlug({
            path: { slug: params.slug },
            query: { limit: params.limit },
          })

          if ('statusCode' in response.data) {
            // нужно чтобы сузить тип
            return {
              error: {
                status: response.data.statusCode,
                message: response.data.message,
              },
            }
          }

          return {
            data: response.data.movies.docs.map(item => ({
              ...mapDocToMovie(item.movie),
              position: item.position,
              positionDiff: item.positionDiff,
            })),
          }
        } catch (error) {
          return { error: toQueryError(error) }
        }
      },
    }),
  }),
})

const isNotFound = (error: QueryError) => error.status === 404

// Отдельный injectEndpoints: queryFn ссылается на movieApi.endpoints.getMovieDetail, а внутри
// самого инициализатора movieApi это дало бы циклический вывод типов.
export const movieByIdsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getMoviesByIds: build.query<Movie[], number[]>({
      queryFn: async (ids, { dispatch }) => {
        // Детали берём через initiate: кеш общий с /movie/:id — один запрос на id.
        // subscribe: false — подписка не нужна, queryFn сам ждёт результат.
        const results = await Promise.allSettled(
          ids.map(id =>
            dispatch(
              movieApi.endpoints.getMovieDetail.initiate(id, {
                subscribe: false,
              }),
            ).unwrap(),
          ),
        )

        const movies = results
          .filter(result => result.status === 'fulfilled')
          .map(result => result.value)

        // Все id 404 → фильмы удалены, показываем пустой грид без Retry (нечего повторять).
        // Хотя бы одна ошибка не 404 (сеть, 5xx, quota) → это восстановимо, отдаём ошибку,
        // чтобы QueryBoundary показал error-фолбэк с рабочим Retry, а не тихо подменял его
        // статичным EmptyState без кнопки.
        const hasRecoverableFailure = results.some(
          result =>
            result.status === 'rejected' &&
            !isNotFound(result.reason as QueryError),
        )

        if (movies.length === 0 && hasRecoverableFailure) {
          return { error: { message: 'Failed to load movies by ids' } }
        }

        return { data: movies }
      },
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

// Отдельный injectEndpoints по той же причине, что movieByIdsApi: queryFn ссылается на
// endpoints movieApi.
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
            movieApi.endpoints.getCatalogCursorStep.initiate(
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
          // unwrap бросает error из queryFn шага — это уже QueryError
          return { error: error as QueryError }
        }
      },
    }),
  }),
})

export const catalogApi = baseApi.injectEndpoints({
  endpoints: build => ({
    // Единый endpoint /search: один хук на оба режима, поэтому при переключении поиск ↔
    // каталог data держит прежнюю сетку, а не проваливается в скелетон (как было бы с двумя
    // хуками и skip). Сам ничего не запрашивает — делегирует в кеш нижних endpoints.
    getCatalog: build.query<CatalogPageResult, CatalogArgs>({
      queryFn: async ({ query, params, page }, { dispatch }) => {
        try {
          const data = query
            ? await dispatch(
                movieApi.endpoints.getSearchMovies.initiate(
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

          return { data }
        } catch (error) {
          return { error: error as QueryError }
        }
      },
    }),
  }),
})

export const { useGetMoviesByIdsQuery } = movieByIdsApi
export const { useGetCatalogQuery } = catalogApi

export const {
  useGetMoviesQuery,
  useGetPopularMoviesQuery,
  useGetMovieDetailQuery,
  useGetMovieImagesQuery,
  useGetGenreDictionaryQuery,
  useGetCountryDictionaryQuery,
} = movieApi
