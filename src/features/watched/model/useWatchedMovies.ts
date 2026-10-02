import { useGetMoviesByIdsQuery } from '@entities/movie'

import { useWatched } from './useWatched'

// Пустой список id — запрос не нужен (страница рисует своё пустое состояние).
export const useWatchedMovies = () => {
  const { ids } = useWatched()

  return useGetMoviesByIdsQuery(ids, { skip: ids.length === 0 })
}
