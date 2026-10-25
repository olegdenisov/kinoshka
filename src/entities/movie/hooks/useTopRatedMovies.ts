import { useGetMoviesQuery } from '../api/catalogApi'
import type { MovieType } from '../model/types'

export const useTopRatedMovies = (params?: { type: MovieType[] }) =>
  useGetMoviesQuery({
    sortField: ['rating.kp'],
    'rating.kp': ['7-10'],
    sortType: ['-1'],
    type: params?.type,
  })
