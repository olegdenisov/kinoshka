import { getMoviesByIds, type Movie } from '@entities/movie'
import { use } from 'react'

import { useWatched } from './useWatched'

export const useWatchedMovies = (): Movie[] => {
  const { ids } = useWatched()

  return use(getMoviesByIds(ids))
}
