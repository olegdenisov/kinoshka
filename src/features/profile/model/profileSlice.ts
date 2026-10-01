import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { persistSlice, subscribeSlot } from '@shared/lib'
import type { StartListening } from '@shared/lib'

import { profileNameSlot } from './profileStorage'

type ProfileState = { name: string }

export type ProfileRootState = { profile: ProfileState }

// initialState — функция: каждый makeStore() (в тестах — каждый тест) читает актуальный localStorage.
const profileSlice = createSlice({
  name: 'profile',
  initialState: (): ProfileState => ({ name: profileNameSlot.get() }),
  reducers: {
    nameSet: (state, action: PayloadAction<string>) => {
      state.name = action.payload
    },
    // Значение пришло из слота (другая вкладка или откат при отказе записи) — писать его обратно
    // не нужно, поэтому persist слушает только nameSet.
    hydrated: (state, action: PayloadAction<string>) => {
      state.name = action.payload
    },
  },
  selectors: {
    selectName: state => state.name,
  },
})

export const { nameSet, hydrated: profileHydrated } = profileSlice.actions
export const { selectName } = profileSlice.selectors
export const profileReducer = profileSlice.reducer
export const profileReducerPath = profileSlice.reducerPath

type PersistenceStore = {
  getState: () => ProfileRootState
  dispatch: (action: { type: string }) => unknown
}

// Регистрирует запись в слот и приём изменений из других вкладок; возвращает общий unsubscribe.
export const registerProfilePersistence = (
  store: PersistenceStore,
  startListening: StartListening<ProfileRootState>,
) => {
  const stopPersist = persistSlice<ProfileRootState, string>({
    startListening,
    slot: profileNameSlot,
    select: state => selectName(state),
    matcher: nameSet.match,
    rollback: profileHydrated,
  })
  const stopSubscribe = subscribeSlot<ProfileRootState, string>(
    store,
    profileNameSlot,
    { select: state => selectName(state), hydrated: profileHydrated },
  )

  return () => {
    stopPersist()
    stopSubscribe()
  }
}
