import { combineReducers, configureStore } from '@reduxjs/toolkit'
import { baseApi } from '@shared/api'
import { createAppListenerMiddleware } from '@shared/lib'

const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
})

export type RootState = ReturnType<typeof rootReducer>

// Фабрика, а не только синглтон: тесты создают свежий стор на каждый тест (renderWithStore), поэтому
// глобальный сброс кеша RTK Query между тестами не нужен. Listener middleware тоже создаётся на
// каждый стор — общий экземпляр копил бы listener'ы от всех сторов, созданных в тестах.
export const makeStore = (preloadedState?: Partial<RootState>) => {
  const listenerMiddleware = createAppListenerMiddleware()

  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware()
        .prepend(listenerMiddleware.middleware)
        .concat(baseApi.middleware),
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type AppDispatch = AppStore['dispatch']

export const store = makeStore()
