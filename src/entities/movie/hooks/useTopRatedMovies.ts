import { moviesQueryStore, type MoviesRequestParams } from '../api/getMovies'
import type { MovieType } from '../model/types'

const buildTopRatedParams = (params?: {
  type: MovieType[]
}): MoviesRequestParams => ({
  sortField: ['rating.kp'],
  'rating.kp': ['7-10'],
  sortType: ['-1'],
  type: params?.type,
})

export const useTopRatedMovies = (params?: { type: MovieType[] }) =>
  moviesQueryStore.useQuery(buildTopRatedParams(params))
