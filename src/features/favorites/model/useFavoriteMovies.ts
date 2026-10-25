import { useMoviesByIds, type Movie } from '@entities/movie'
import type { QueryResult } from '@shared/lib'

import { useFavorites } from './useFavorites'

export const useFavoriteMovies = (): QueryResult<Movie[]> => {
  const { ids } = useFavorites()

  return useMoviesByIds(ids)
}
