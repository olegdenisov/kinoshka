import { getMoviesByIds, type Movie } from '@entities/movie'
import { use } from 'react'

import { useFavorites } from './useFavorites'

export const useFavoriteMovies = (): Movie[] => {
  const { ids } = useFavorites()

  return use(getMoviesByIds(ids))
}
