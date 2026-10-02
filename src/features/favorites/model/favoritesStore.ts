import { createPersistedStore, trackEvent } from '@shared/lib'

import { favoritesSlot } from './favoritesStorage'

type FavoritesState = {
  ids: number[]
  toggle: (id: number) => void
  add: (id: number) => void
  remove: (id: number) => void
  clear: () => void
}

export const useFavoritesStore = createPersistedStore<FavoritesState, number[]>(
  {
    name: 'favorites',
    slot: favoritesSlot,
    select: state => state.ids,
    merge: (ids, state) => ({ ...state, ids }),
    // Read-modify-write идёт через get(), а не замыкание хука: два вызова в одном тике не
    // затирают друг друга. При недоступном хранилище commit возвращает стор к содержимому
    // хранилища — состояние остаётся прежним.
    creator: (commit, get) => {
      const remove = (id: number) =>
        commit({ ids: get().ids.filter(existingId => existingId !== id) })

      return {
        ids: favoritesSlot.get(),
        add: id => {
          const { ids } = get()
          if (!ids.includes(id)) commit({ ids: [...ids, id] })
        },
        remove,
        toggle: id => {
          const { ids } = get()
          if (ids.includes(id)) {
            remove(id)
            return
          }

          // trackEvent только при успешной записи: commit() не бросает при недоступном
          // хранилище, а возвращает false — иначе Plausible считал бы "favorite added" в
          // сессиях, где избранное на самом деле не сохранилось.
          if (commit({ ids: [...ids, id] })) trackEvent('favorite added')
        },
        clear: () => commit({ ids: [] }),
      }
    },
  },
)
