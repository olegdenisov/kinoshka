import { baseApi } from '@shared/api'

import { makeStore, store } from './store'

// Тестовый endpoint без сети: нужен, чтобы положить запись в кеш RTK Query одного стора.
const testApi = baseApi.injectEndpoints({
  endpoints: build => ({
    storeTestPing: build.query<string, void>({
      queryFn: () => ({ data: 'pong' }),
    }),
  }),
})

describe('makeStore', () => {
  it('в стейте есть срез RTK Query под reducerPath api', () => {
    expect(makeStore().getState()).toHaveProperty(baseApi.reducerPath)
  })

  it('два вызова дают независимые сторы — кеш одного не виден в другом', async () => {
    const first = makeStore()
    const second = makeStore()

    await first.dispatch(testApi.endpoints.storeTestPing.initiate())

    expect(
      testApi.endpoints.storeTestPing.select()(first.getState()).data,
    ).toBe('pong')
    expect(
      testApi.endpoints.storeTestPing.select()(second.getState()).data,
    ).toBeUndefined()
  })

  it('preloadedState попадает в стор', async () => {
    const source = makeStore()
    await source.dispatch(testApi.endpoints.storeTestPing.initiate())

    const restored = makeStore(source.getState())

    expect(
      testApi.endpoints.storeTestPing.select()(restored.getState()).data,
    ).toBe('pong')
  })

  it('singleton store создан тем же makeStore', () => {
    expect(store.getState()).toHaveProperty(baseApi.reducerPath)
  })
})
