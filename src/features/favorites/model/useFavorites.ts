import { useShallow } from 'zustand/react/shallow'

import { useFavoritesStore } from './favoritesStore'

export type UseFavoritesResult = {
  ids: number[]
  isFavorite: (id: number) => boolean
  toggle: (id: number) => void
  add: (id: number) => void
  remove: (id: number) => void
  clear: () => void
}

export const useFavorites = (): UseFavoritesResult => {
  const ids = useFavoritesStore(state => state.ids)
  const { toggle, add, remove, clear } = useFavoritesStore(
    useShallow(state => ({
      toggle: state.toggle,
      add: state.add,
      remove: state.remove,
      clear: state.clear,
    })),
  )

  return {
    ids,
    isFavorite: id => ids.includes(id),
    add,
    remove,
    toggle,
    clear,
  }
}
