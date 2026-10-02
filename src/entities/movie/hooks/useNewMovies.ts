import { moviesStore, type MoviesRequestParams } from '../api/getMovies'
import type { MovieType } from '../model/types'

const buildNewMoviesParams = (params?: {
  type: MovieType[]
}): MoviesRequestParams => ({
  ...params,
  year: [new Date().getFullYear().toString()],
})

export const useNewMovies = (params?: { type: MovieType[] }) =>
  moviesStore.useQuery(buildNewMoviesParams(params))
