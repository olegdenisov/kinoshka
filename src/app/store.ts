import {
  favoritesReducer,
  favoritesReducerPath,
  registerFavoritesPersistence,
} from '@features/favorites'
import {
  profileReducer,
  profileReducerPath,
  registerProfilePersistence,
} from '@features/profile'
import {
  registerThemePersistence,
  themeReducer,
  themeReducerPath,
} from '@features/theme'
import {
  registerWatchedPersistence,
  watchedReducer,
  watchedReducerPath,
} from '@features/watched'
import {
  registerWatchlistPersistence,
  watchlistReducer,
  watchlistReducerPath,
} from '@features/watchlist'
import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { baseApi } from '@shared/api'
import { createAppListenerMiddleware } from '@shared/lib'
import type { StartListening } from '@shared/lib'

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  [themeReducerPath]: themeReducer,
  [favoritesReducerPath]: favoritesReducer,
  [profileReducerPath]: profileReducer,
  [watchedReducerPath]: watchedReducer,
  [watchlistReducerPath]: watchlistReducer,
})

export type RootState = ReturnType<typeof rootReducer>

type PersistenceStore = {
  getState: () => RootState
  dispatch: (action: { type: string }) => unknown
}

// Единая точка регистрации persist: persistSlice (стор → слот) и subscribeSlot (другая вкладка →
// стор) для каждой фичи с localStorage-стейтом. Возвращает teardown, снимающий подписки на слоты —
// они висят на window/общем emitter'е и без отписки переживали бы свой стор.
const setupPersistence = (
  store: PersistenceStore,
  startListening: StartListening<RootState>,
): (() => void) => {
  const unsubscribers: Array<() => void> = [
    registerThemePersistence(store, startListening),
    registerFavoritesPersistence(store, startListening),
    registerProfilePersistence(store, startListening),
    registerWatchedPersistence(store, startListening),
    registerWatchlistPersistence(store, startListening),
  ]

  return () => {
    for (const unsubscribe of unsubscribers) unsubscribe()
  }
}

// Фабрика, а не только синглтон: тесты создают свежий стор на каждый тест (renderWithStore), поэтому
// глобальный сброс кеша RTK Query между тестами не нужен. Listener middleware тоже создаётся на
// каждый стор — общий экземпляр копил бы listener'ы от всех сторов, созданных в тестах.
export const makeStore = (preloadedState?: Partial<RootState>) => {
  const listenerMiddleware = createAppListenerMiddleware()

  const store = configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware()
        .prepend(listenerMiddleware.middleware)
        .concat(baseApi.middleware),
  })

  const teardownPersistence = setupPersistence(
    store,
    listenerMiddleware.startListening.withTypes<RootState>(),
  )

  // teardown нужен тестам (renderWithStore зовёт его после каждого теста); у singleton-стора
  // приложения он не вызывается — стор живёт всё время жизни вкладки.
  return Object.assign(store, {
    teardown: () => {
      teardownPersistence()
      listenerMiddleware.clearListeners()
    },
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']

export const store = makeStore()
