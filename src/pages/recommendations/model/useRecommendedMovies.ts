import { useFavorites } from '@features/favorites'

import { useGetRecommendationsQuery } from '../api/recommendationsApi'

// Пустое избранное — запрос не нужен: страница рисует своё пустое состояние до QueryBoundary.
export const useRecommendedMovies = () => {
  const { ids } = useFavorites()

  return useGetRecommendationsQuery(undefined, { skip: ids.length === 0 })
}
