import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { persistSlice, subscribeSlot } from '@shared/lib'
import type { StartListening } from '@shared/lib'

import { themeSlot } from './themeStorage'
import type { Theme } from './themeStorage'

export type ThemeState = { theme: Theme }

export type ThemeRootState = { theme: ThemeState }

// initialState — функция: каждый makeStore() (в тестах — каждый тест) читает актуальный localStorage.
const themeSlice = createSlice({
  name: 'theme',
  initialState: (): ThemeState => ({ theme: themeSlot.get() }),
  reducers: {
    themeSet: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload
    },
    // Значение пришло из слота (другая вкладка или откат при отказе записи) — писать его обратно
    // не нужно, поэтому persist слушает только themeSet.
    hydrated: (state, action: PayloadAction<Theme>) => {
      state.theme = action.payload
    },
  },
  selectors: {
    selectTheme: state => state.theme,
  },
})

export const { themeSet, hydrated: themeHydrated } = themeSlice.actions
export const { selectTheme } = themeSlice.selectors
export const themeReducer = themeSlice.reducer
export const themeReducerPath = themeSlice.reducerPath

type PersistenceStore = {
  getState: () => ThemeRootState
  dispatch: (action: { type: string }) => unknown
}

// Регистрирует запись в слот и приём изменений из других вкладок; возвращает общий unsubscribe.
export const registerThemePersistence = (
  store: PersistenceStore,
  startListening: StartListening<ThemeRootState>,
) => {
  const stopPersist = persistSlice<ThemeRootState, Theme>({
    startListening,
    slot: themeSlot,
    select: state => selectTheme(state),
    matcher: themeSet.match,
    rollback: themeHydrated,
  })
  const stopSubscribe = subscribeSlot<ThemeRootState, Theme>(store, themeSlot, {
    select: state => selectTheme(state),
    hydrated: themeHydrated,
  })

  return () => {
    stopPersist()
    stopSubscribe()
  }
}
