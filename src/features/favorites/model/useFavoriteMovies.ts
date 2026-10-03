import { getMoviesByIds, type Movie } from '@entities/movie'
import { useAtom } from '@reatom/react'
import { use } from 'react'

import { favoriteIds } from './favorites'

// Временно: заменяется ресурсом favoriteMovies в Task 9.
export const useFavoriteMovies = (): Movie[] => {
  const [ids] = useAtom(favoriteIds)
  return use(getMoviesByIds([...ids]))
}
