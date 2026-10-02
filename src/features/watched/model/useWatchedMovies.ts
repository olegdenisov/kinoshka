import { useMoviesByIds, type Movie } from '@entities/movie'
import type { QueryResult } from '@shared/lib'

import { useWatched } from './useWatched'

export const useWatchedMovies = (): QueryResult<Movie[]> => {
  const { ids } = useWatched()

  return useMoviesByIds(ids)
}
