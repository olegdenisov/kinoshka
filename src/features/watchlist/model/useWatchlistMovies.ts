import { useMoviesByIds, type Movie } from '@entities/movie'
import type { QueryResult } from '@shared/lib'

import { useWatchlist } from './useWatchlist'

export const useWatchlistMovies = (): QueryResult<Movie[]> => {
  const { ids } = useWatchlist()

  return useMoviesByIds(ids)
}
