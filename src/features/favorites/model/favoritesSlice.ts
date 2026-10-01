import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import { baseApi } from '@shared/api'
import { subscribeSlot, toggleId } from '@shared/lib'
import type { StartListening, SubscribableStore } from '@shared/lib'

import { favoritesSlot } from './favoritesStorage'

type FavoritesState = { ids: number[] }

export type FavoritesRootState = { favorites: FavoritesState }

// initialState — функция: каждый makeStore() (в тестах — каждый тест) читает актуальный localStorage.
const favoritesSlice = createSlice({
  name: 'favorites',
  initialState: (): FavoritesState => ({ ids: favoritesSlot.get() }),
  reducers: {
    // Оптимистичное изменение (mutation toggleFavorite).
    toggled: (state, action: PayloadAction<number>) => {
      toggleId(state.ids, action.payload)
    },
    // Значение пришло из слота другой вкладки.
    hydrated: (state, action: PayloadAction<number[]>) => {
      state.ids = action.payload
    },
    // Откат неудачной записи к значению слота. Отдельно от hydrated: тот инвалидирует рекомендации,
    // а откат возвращает стейт к тому, по чему они уже построены.
    rolledBack: (state, action: PayloadAction<number[]>) => {
      state.ids = action.payload
    },
  },
  selectors: {
    selectIds: state => state.ids,
  },
})

export const {
  toggled: favoritesToggled,
  hydrated: favoritesHydrated,
  rolledBack: favoritesRolledBack,
} = favoritesSlice.actions
export const { selectIds: selectFavoriteIds } = favoritesSlice.selectors
export const favoritesReducer = favoritesSlice.reducer
export const favoritesReducerPath = favoritesSlice.reducerPath

// В отличие от остальных фич, persistSlice здесь не регистрируется: единственный путь записи в слот —
// mutation toggleFavorite (см. favoritesApi.ts), иначе запись шла бы дважды. Остаётся только приём
// изменений из других вкладок. Возвращает общий unsubscribe.
export const registerFavoritesPersistence = (
  store: SubscribableStore<FavoritesRootState>,
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
