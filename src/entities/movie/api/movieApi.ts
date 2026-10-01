import {
  apiClient,
  ApiError,
  baseApi,
  toQueryError,
  type QueryError,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'

import type { Movie, MovieDetail, PopularMovie } from '../model/types'
import { mapDocToMovie } from './mapDocToMovie'
import { mapDtoToMovieDetail } from './mapDtoToMovieDetail'

export type MoviesParams = MovieControllerFindManyByQueryV15Data['query']
export type PopularMoviesParams = { slug: string; limit: number }

export type MovieImage = {
  url: string
  previewUrl?: string
}

// Чистая функция запроса без стора: её зовёт и queryFn getMovieDetail, и временный мост
// getMoviesByIds (до Task 12 рекомендации читают его через createCachedFetcher). Бросает ApiError —
// мост различает 404 по instanceof.
export const fetchMovieDetail = async (id: number): Promise<MovieDetail> => {
  const response = await apiClient.getV15MovieById({ path: { id } })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return mapDtoToMovieDetail(response.data)
}

export const movieApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getMovieDetail: build.query<MovieDetail, number>({
      queryFn: async id => {
        try {
          return { data: await fetchMovieDetail(id) }
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

export const { useGetMoviesByIdsQuery } = movieByIdsApi

export const {
  useGetMoviesQuery,
  useGetPopularMoviesQuery,
  useGetMovieDetailQuery,
  useGetMovieImagesQuery,
} = movieApi
