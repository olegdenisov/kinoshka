import { useGetMoviesQuery } from '../api/catalogApi'
import type { MovieType } from '../model/types'

export const useNewMovies = (params?: { type: MovieType[] }) =>
  useGetMoviesQuery({
    ...params,
    year: [new Date().getFullYear().toString()],
  })
