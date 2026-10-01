import { useGetMoviesQuery } from '../api/movieApi'
import type { MovieType } from '../model/types'

export const useNewMovies = (params?: { type: MovieType[] }) =>
  useGetMoviesQuery({
    ...params,
    year: [new Date().getFullYear().toString()],
  })
