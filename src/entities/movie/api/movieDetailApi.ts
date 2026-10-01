import {
  apiClient,
  asQueryError,
  baseApi,
  runQuery,
  unwrapErrorDto,
} from '@shared/api'

import type { Movie, MovieDetail } from '../model/types'
import { mapDtoToMovieDetail } from './mapDtoToMovieDetail'
import type { MovieImage } from './types'

// Сколько кадров показывает вкладка Media.
const MEDIA_IMAGES_LIMIT = 8

export const movieDetailApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getMovieDetail: build.query<MovieDetail, number>({
      queryFn: id =>
        runQuery(async () => {
          const response = await apiClient.getV15MovieById({ path: { id } })
          return mapDtoToMovieDetail(unwrapErrorDto(response.data))
        }),
    }),
    getMovieImages: build.query<MovieImage[], number>({
      queryFn: id =>
        runQuery(async () => {
          const response = await apiClient.getV15Image({
            query: {
              movieId: [String(id)],
              type: ['frame', 'screenshot'],
              limit: MEDIA_IMAGES_LIMIT,
              selectFields: ['url', 'previewUrl'],
            },
          })

          // error-DTO в теле 200 — медиа-вкладка просто пустая, ошибку не показываем
          if (!('docs' in response.data)) return []

          return response.data.docs
            .filter(
              (image): image is typeof image & { url: string } => !!image.url,
            )
            .map(image => ({
              url: image.url,
              previewUrl: image.previewUrl ?? undefined,
            }))
        }),
    }),
  }),
})

// Отдельный injectEndpoints: queryFn ссылается на movieDetailApi.endpoints.getMovieDetail, а внутри
// самого инициализатора movieDetailApi это дало бы циклический вывод типов.
export const movieByIdsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getMoviesByIds: build.query<Movie[], number[]>({
      queryFn: async (ids, { dispatch }) => {
        // Детали берём через initiate: кеш общий с /movie/:id — один запрос на id.
        // subscribe: false — подписка не нужна, queryFn сам ждёт результат.
        const results = await Promise.allSettled(
          ids.map(id =>
            dispatch(
              movieDetailApi.endpoints.getMovieDetail.initiate(id, {
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
            asQueryError(result.reason).status !== 404,
        )

        if (movies.length === 0 && hasRecoverableFailure) {
          return { error: { message: 'Failed to load movies by ids' } }
        }

        return { data: movies }
      },
    }),
  }),
})

export const { useGetMovieDetailQuery, useGetMovieImagesQuery } = movieDetailApi
export const { useGetMoviesByIdsQuery } = movieByIdsApi
