import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { registerSlotPersistence, toggleId } from '@shared/lib'
import type { StartListening, SubscribableStore } from '@shared/lib'

import { watchedSlot } from './watchedStorage'

type WatchedState = { ids: number[] }

export type WatchedRootState = { watched: WatchedState }

// initialState — функция: каждый makeStore() (в тестах — каждый тест) читает актуальный localStorage.
const watchedSlice = createSlice({
  name: 'watched',
  initialState: (): WatchedState => ({ ids: watchedSlot.get() }),
  reducers: {
    toggled: (state, action: PayloadAction<number>) => {
      toggleId(state.ids, action.payload)
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

// Регистрирует запись в слот и приём изменений из других вкладок; возвращает общий unsubscribe.
export const registerWatchedPersistence = (
  store: SubscribableStore<WatchedRootState>,
  startListening: StartListening<WatchedRootState>,
) =>
  registerSlotPersistence<WatchedRootState, number[]>({
    store,
    startListening,
    slot: watchedSlot,
    select: state => selectWatchedIds(state),
    matcher: watchedToggled.match,
    hydrated: watchedHydrated,
  })
