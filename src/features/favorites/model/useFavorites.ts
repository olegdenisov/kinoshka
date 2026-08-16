import { useStorageSlot } from '@shared/lib'

import { favoritesSlot } from './favoritesStorage'

export type UseFavoritesResult = {
  ids: number[]
  isFavorite: (id: number) => boolean
  toggle: (id: number) => void
  add: (id: number) => void
  remove: (id: number) => void
  clear: () => void
}

export const useFavorites = (): UseFavoritesResult => {
  const [ids, setIds] = useStorageSlot(favoritesSlot)

  return {
    ids,
    isFavorite: id => ids.includes(id),
    add: id => {
      if (!ids.includes(id)) {
        setIds([...ids, id])
      }
    },
    remove: id => setIds(ids.filter(existingId => existingId !== id)),
    toggle: id => {
      setIds(
        ids.includes(id)
          ? ids.filter(existingId => existingId !== id)
          : [...ids, id],
      )
    },
    clear: () => setIds([]),
  }
}
