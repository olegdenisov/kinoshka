import { createPersistedStore } from '@shared/lib'

import { watchlistSlot } from './watchlistStorage'

type WatchlistState = {
  ids: number[]
  toggle: (id: number) => void
}

export const useWatchlistStore = createPersistedStore<WatchlistState, number[]>(
  {
    name: 'watchlist',
    slot: watchlistSlot,
    select: state => state.ids,
    merge: (ids, state) => ({ ...state, ids }),
    creator: (commit, get) => ({
      ids: watchlistSlot.get(),
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
  },
)
