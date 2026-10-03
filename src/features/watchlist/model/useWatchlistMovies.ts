import { getMoviesByIds, type Movie } from '@entities/movie'
import { useAtom } from '@reatom/react'
import { use } from 'react'

import { watchlistIds } from './watchlist'

// Временно: заменяется ресурсом в Task 9.
export const useWatchlistMovies = (): Movie[] => {
  const [ids] = useAtom(watchlistIds)
  return use(getMoviesByIds([...ids]))
}
