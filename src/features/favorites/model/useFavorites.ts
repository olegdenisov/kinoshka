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
      const current = favoritesSlot.get()
      if (!current.includes(id)) {
        setIds([...current, id])
      }
    },
    remove: id =>
      setIds(favoritesSlot.get().filter(existingId => existingId !== id)),
    toggle: id => {
      const current = favoritesSlot.get()
      setIds(
        current.includes(id)
          ? current.filter(existingId => existingId !== id)
          : [...current, id],
      )
    },
    clear: () => setIds([]),
  }
}
