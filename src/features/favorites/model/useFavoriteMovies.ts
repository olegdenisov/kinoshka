import { useGetMoviesByIdsQuery } from '@entities/movie'

import { useFavorites } from './useFavorites'

// Пустой список id — запрос не нужен (страница рисует своё пустое состояние).
export const useFavoriteMovies = () => {
  const { ids } = useFavorites()

  return useGetMoviesByIdsQuery(ids, { skip: ids.length === 0 })
}
