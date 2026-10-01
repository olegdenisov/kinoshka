import {
  apiClient,
  ApiError,
  baseApi,
  toQueryError,
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

export const {
  useGetMoviesQuery,
  useGetPopularMoviesQuery,
  useGetMovieDetailQuery,
  useGetMovieImagesQuery,
} = movieApi
