import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { baseApi } from '@shared/api'
import { subscribeSlot } from '@shared/lib'
import type { StartListening } from '@shared/lib'

import { favoritesSlot } from './favoritesStorage'

type FavoritesState = { ids: number[] }

export type FavoritesRootState = { favorites: FavoritesState }

// initialState — функция: каждый makeStore() (в тестах — каждый тест) читает актуальный localStorage.
const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: (): FavoritesState => ({ ids: favoritesSlot.get() }),
  reducers: {
    // Оптимистичное изменение и его откат (mutation toggleFavorite). Редьюсер читает ids из state,
    // а не из замыкания хука: два toggled подряд в одном тике не затирают друг друга.
    toggled: (state, action: PayloadAction<number>) => {
      const index = state.ids.indexOf(action.payload)
      if (index === -1) state.ids.push(action.payload)
      else state.ids.splice(index, 1)
    },
    // Значение пришло из слота другой вкладки.
    hydrated: (state, action: PayloadAction<number[]>) => {
      state.ids = action.payload
    },
  },
  selectors: {
    selectIds: state => state.ids,
  },
})

export const { toggled: favoritesToggled, hydrated: favoritesHydrated } =
  favoritesSlice.actions
export const { selectIds: selectFavoriteIds } = favoritesSlice.selectors
export const favoritesReducer = favoritesSlice.reducer
export const favoritesReducerPath = favoritesSlice.reducerPath

type PersistenceStore = {
  getState: () => FavoritesRootState
  dispatch: (action: { type: string }) => unknown
}

// В отличие от остальных фич, persistSlice здесь не регистрируется: единственный путь записи в слот —
// mutation toggleFavorite (см. favoritesApi.ts), иначе запись шла бы дважды. Остаётся только приём
// изменений из других вкладок. Возвращает общий unsubscribe.
export const registerFavoritesPersistence = (
  store: PersistenceStore,
  startListening: StartListening<FavoritesRootState>,
) => {
  const stopSubscribe = subscribeSlot<FavoritesRootState, number[]>(
    store,
    favoritesSlot,
    { select: state => selectFavoriteIds(state), hydrated: favoritesHydrated },
  )
  // Изменение из другой вкладки приходит мимо mutation, поэтому её invalidatesTags не срабатывает —
  // рекомендации, построенные по старым id, инвалидируем сами. hydrated диспатчит только subscribeSlot,
  // и только когда слот разошёлся со стейтом, — записи своей вкладки сюда не попадают.
  const stopInvalidate = startListening({
    actionCreator: favoritesHydrated,
    effect: (_action, api) => {
      api.dispatch(baseApi.util.invalidateTags(['Recommendations']))
    },
  })

  return () => {
    stopSubscribe()
    stopInvalidate()
  }
}
