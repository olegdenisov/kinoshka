import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { persistSlice, subscribeSlot } from '@shared/lib'
import type { StartListening } from '@shared/lib'

import { watchlistSlot } from './watchlistStorage'

type WatchlistState = { ids: number[] }

export type WatchlistRootState = { watchlist: WatchlistState }

// initialState — функция: каждый makeStore() (в тестах — каждый тест) читает актуальный localStorage.
const watchlistSlice = createSlice({
  name: 'watchlist',
  initialState: (): WatchlistState => ({ ids: watchlistSlot.get() }),
  reducers: {
    // Редьюсер читает ids из state, а не из замыкания хука: два toggled подряд в одном тике
    // не затирают друг друга.
    toggled: (state, action: PayloadAction<number>) => {
      const index = state.ids.indexOf(action.payload)
      if (index === -1) state.ids.push(action.payload)
      else state.ids.splice(index, 1)
    },
    // Значение пришло из слота (другая вкладка или откат при отказе записи) — писать его обратно
    // не нужно, поэтому persist слушает только toggled.
    hydrated: (state, action: PayloadAction<number[]>) => {
      state.ids = action.payload
    },
  },
  selectors: {
    selectIds: state => state.ids,
  },
})

export const { toggled: watchlistToggled, hydrated: watchlistHydrated } =
  watchlistSlice.actions
export const { selectIds: selectWatchlistIds } = watchlistSlice.selectors
export const watchlistReducer = watchlistSlice.reducer
export const watchlistReducerPath = watchlistSlice.reducerPath

type PersistenceStore = {
  getState: () => WatchlistRootState
  dispatch: (action: { type: string }) => unknown
}

// Регистрирует запись в слот и приём изменений из других вкладок; возвращает общий unsubscribe.
export const registerWatchlistPersistence = (
  store: PersistenceStore,
  startListening: StartListening<WatchlistRootState>,
) => {
  const stopPersist = persistSlice<WatchlistRootState, number[]>({
    startListening,
    slot: watchlistSlot,
    select: state => selectWatchlistIds(state),
    matcher: watchlistToggled.match,
    rollback: watchlistHydrated,
  })
  const stopSubscribe = subscribeSlot<WatchlistRootState, number[]>(
    store,
    watchlistSlot,
    { select: state => selectWatchlistIds(state), hydrated: watchlistHydrated },
  )

  return () => {
    stopPersist()
    stopSubscribe()
  }
}
