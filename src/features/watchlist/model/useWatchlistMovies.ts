import { getMoviesByIds, type Movie } from '@entities/movie'
import { use } from 'react'

import { useWatchlist } from './useWatchlist'

export const useWatchlistMovies = (): Movie[] => {
  const { ids } = useWatchlist()

  return use(getMoviesByIds(ids))
}
