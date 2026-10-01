import {
  apiClient,
  baseApi,
  toQueryError,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'

import type { Movie, PopularMovie } from '../model/types'
import { mapDocToMovie } from './mapDocToMovie'

export type MoviesParams = MovieControllerFindManyByQueryV15Data['query']
export type PopularMoviesParams = { slug: string; limit: number }

export const movieApi = baseApi.injectEndpoints({
  endpoints: build => ({
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

export const { useGetMoviesQuery, useGetPopularMoviesQuery } = movieApi
