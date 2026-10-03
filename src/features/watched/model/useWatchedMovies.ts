import { getMoviesByIds, type Movie } from '@entities/movie'
import { useAtom } from '@reatom/react'
import { use } from 'react'

import { watchedIds } from './watched'

// Временно: заменяется ресурсом в Task 9.
export const useWatchedMovies = (): Movie[] => {
  const [ids] = useAtom(watchedIds)
  return use(getMoviesByIds([...ids]))
}
