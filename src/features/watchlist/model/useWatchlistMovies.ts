import { useGetMoviesByIdsQuery } from '@entities/movie'

import { useWatchlist } from './useWatchlist'

// Пустой список id — запрос не нужен (страница рисует своё пустое состояние).
export const useWatchlistMovies = () => {
  const { ids } = useWatchlist()

  return useGetMoviesByIdsQuery(ids, { skip: ids.length === 0 })
}
