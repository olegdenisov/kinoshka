import { createPersistedStore } from '@shared/lib'

import { watchedSlot } from './watchedStorage'

type WatchedState = {
  ids: number[]
  toggle: (id: number) => void
}

export const useWatchedStore = createPersistedStore<WatchedState, number[]>({
  name: 'watched',
  slot: watchedSlot,
  select: state => state.ids,
  merge: (ids, state) => ({ ...state, ids }),
  creator: (commit, get) => ({
    ids: watchedSlot.get(),
    // Читаем актуальный стейт через get(), а не из замыкания хука: два toggle подряд в одном
    // тике не должны затирать друг друга. При недоступном хранилище commit вернёт стор к
    // содержимому хранилища — состояние остаётся прежним.
    toggle: id => {
      const { ids } = get()
      commit({
        ids: ids.includes(id)
          ? ids.filter(existingId => existingId !== id)
          : [...ids, id],
      })
    },
  }),
})
