import { useSelector } from 'react-redux'

import { useToggleFavoriteMutation } from './favoritesApi'
import { selectFavoriteIds } from './favoritesSlice'
import type { FavoritesRootState } from './favoritesSlice'

export type UseFavoritesResult = {
  ids: number[]
  isFavorite: (id: number) => boolean
  toggle: (id: number) => void
}

export const useFavorites = (): UseFavoritesResult => {
  const ids = useSelector((state: FavoritesRootState) =>
    selectFavoriteIds(state),
  )
  const [toggleFavorite] = useToggleFavoriteMutation()

  return {
    ids,
    isFavorite: id => ids.includes(id),
    // Оптимистичное изменение, откат при отказе записи и аналитика — в onQueryStarted mutation.
    toggle: id => {
      void toggleFavorite(id)
    },
  }
}
