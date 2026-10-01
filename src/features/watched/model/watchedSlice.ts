import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { persistSlice, subscribeSlot } from '@shared/lib'
import type { StartListening } from '@shared/lib'

import { watchedSlot } from './watchedStorage'

export type WatchedState = { ids: number[] }

export type WatchedRootState = { watched: WatchedState }

// initialState — функция: каждый makeStore() (в тестах — каждый тест) читает актуальный localStorage.
const watchedSlice = createSlice({
  name: 'watched',
  initialState: (): WatchedState => ({ ids: watchedSlot.get() }),
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

export const { toggled: watchedToggled, hydrated: watchedHydrated } =
  watchedSlice.actions
export const { selectIds: selectWatchedIds } = watchedSlice.selectors
export const watchedReducer = watchedSlice.reducer
export const watchedReducerPath = watchedSlice.reducerPath

type PersistenceStore = {
  getState: () => WatchedRootState
  dispatch: (action: { type: string }) => unknown
}

// Регистрирует запись в слот и приём изменений из других вкладок; возвращает общий unsubscribe.
export const registerWatchedPersistence = (
  store: PersistenceStore,
  startListening: StartListening<WatchedRootState>,
) => {
  const stopPersist = persistSlice<WatchedRootState, number[]>({
    startListening,
    slot: watchedSlot,
    select: state => selectWatchedIds(state),
    matcher: watchedToggled.match,
    rollback: watchedHydrated,
  })
  const stopSubscribe = subscribeSlot<WatchedRootState, number[]>(
    store,
    watchedSlot,
    { select: state => selectWatchedIds(state), hydrated: watchedHydrated },
  )

  return () => {
    stopPersist()
    stopSubscribe()
  }
}
