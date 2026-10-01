import { baseApi } from '@shared/api'
import type * as SharedLib from '@shared/lib'
import { waitFor } from '@testing-library/react'

import { makeStore } from '../../../test/renderWithStore'
import { favoritesApi } from './favoritesApi'
import { selectFavoriteIds } from './favoritesSlice'
import type { FavoritesRootState } from './favoritesSlice'
import { favoritesSlot } from './favoritesStorage'

vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

// Тестовый потребитель тега Recommendations: настоящий getRecommendations появится в page-слое
// (Task 12). queryFn записывает, какие id избранного он увидел, — по ним видно и сам факт
// перезапроса, и то, что перезапрос прочитал уже обновлённый стейт.
const recommendationsCalls = vi.fn<(ids: number[]) => void>()
const testApi = baseApi.injectEndpoints({
  endpoints: build => ({
    testRecommendations: build.query<number[], void>({
      queryFn: (_arg, api) => {
        const ids = selectFavoriteIds(api.getState() as FavoritesRootState)
        recommendationsCalls(ids)
        return { data: ids }
      },
      providesTags: ['Recommendations'],
    }),
  }),
})

const toggle = (store: ReturnType<typeof makeStore>, id: number) =>
  store.dispatch(favoritesApi.endpoints.toggleFavorite.initiate(id))

const failWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })

beforeEach(() => {
  localStorage.clear()
  vi.mocked(trackEvent).mockClear()
  recommendationsCalls.mockClear()
})

afterEach(() => vi.restoreAllMocks())

describe('toggleFavorite — успех', () => {
  it('добавление: оптимистичный стейт сразу после dispatch, запись в localStorage, trackEvent', async () => {
    const store = makeStore()

    const request = toggle(store, 1)
    expect(selectFavoriteIds(store.getState())).toEqual([1])

    const result = await request
    expect(result.data).toEqual({ added: true })
    expect(favoritesSlot.get()).toEqual([1])
    expect(selectFavoriteIds(store.getState())).toEqual([1])
    expect(trackEvent).toHaveBeenCalledWith('favorite added')
    expect(trackEvent).toHaveBeenCalledTimes(1)
  })

  it('удаление не шлёт событие', async () => {
    favoritesSlot.set([1, 2])
    const store = makeStore()

    const result = await toggle(store, 1)

    expect(result.data).toEqual({ added: false })
    expect(selectFavoriteIds(store.getState())).toEqual([2])
    expect(favoritesSlot.get()).toEqual([2])
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('два toggle разных id в одном тике — оба id в стейте и в localStorage', async () => {
    const store = makeStore()

    const first = toggle(store, 1)
    const second = toggle(store, 2)
    expect(selectFavoriteIds(store.getState())).toEqual([1, 2])

    await Promise.all([first, second])
    expect(selectFavoriteIds(store.getState())).toEqual([1, 2])
    expect(favoritesSlot.get()).toEqual([1, 2])
    expect(trackEvent).toHaveBeenCalledTimes(2)
  })
})

describe('toggleFavorite — отказ записи', () => {
  it('стейт откатывается, localStorage не меняется, trackEvent не вызван', async () => {
    favoritesSlot.set([3])
    const store = makeStore()
    failWrites()

    const request = toggle(store, 1)
    expect(selectFavoriteIds(store.getState())).toEqual([3, 1])

    const result = await request
    expect(result.error).toEqual({ message: 'Failed to save favorites' })
    await waitFor(() =>
      expect(selectFavoriteIds(store.getState())).toEqual([3]),
    )
    expect(favoritesSlot.get()).toEqual([3])
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('отказ при удалении возвращает id обратно', async () => {
    favoritesSlot.set([1])
    const store = makeStore()
    failWrites()

    await toggle(store, 1)

    await waitFor(() =>
      expect(selectFavoriteIds(store.getState())).toEqual([1]),
    )
  })
})

describe('toggleFavorite — инвалидация Recommendations', () => {
  it('успешный toggle перезапрашивает подписанный запрос, и перезапрос видит обновлённые id', async () => {
    const store = makeStore()
    const subscription = store.dispatch(
      testApi.endpoints.testRecommendations.initiate(),
    )
    await subscription
    expect(recommendationsCalls).toHaveBeenCalledTimes(1)

    await toggle(store, 7)

    await waitFor(() => expect(recommendationsCalls).toHaveBeenCalledTimes(2))
    expect(recommendationsCalls).toHaveBeenLastCalledWith([7])
    subscription.unsubscribe()
  })

  it('при ошибке записи тег не инвалидируется', async () => {
    const store = makeStore()
    const subscription = store.dispatch(
      testApi.endpoints.testRecommendations.initiate(),
    )
    await subscription
    failWrites()

    await toggle(store, 7)
    await waitFor(() => expect(selectFavoriteIds(store.getState())).toEqual([]))
    // Даём инвалидации шанс сработать, если бы она была запланирована.
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(recommendationsCalls).toHaveBeenCalledTimes(1)
    subscription.unsubscribe()
  })

  it('storage-событие из другой вкладки инвалидирует Recommendations', async () => {
    const store = makeStore()
    const subscription = store.dispatch(
      testApi.endpoints.testRecommendations.initiate(),
    )
    await subscription

    localStorage.setItem('kinoshka:favorites', JSON.stringify([9]))
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'kinoshka:favorites',
        newValue: JSON.stringify([9]),
      }),
    )

    await waitFor(() => expect(recommendationsCalls).toHaveBeenCalledTimes(2))
    expect(recommendationsCalls).toHaveBeenLastCalledWith([9])
    subscription.unsubscribe()
  })

  it('своя запись в слот не порождает hydrated и лишней инвалидации', async () => {
    const store = makeStore()
    const subscription = store.dispatch(
      testApi.endpoints.testRecommendations.initiate(),
    )
    await subscription
    const dispatched: string[] = []
    const originalDispatch = store.dispatch
    vi.spyOn(store, 'dispatch').mockImplementation(((action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        dispatched.push(String(action.type))
      }
      return originalDispatch(action as never)
    }) as typeof store.dispatch)

    await toggle(store, 3)
    await waitFor(() => expect(recommendationsCalls).toHaveBeenCalledTimes(2))
    await new Promise(resolve => setTimeout(resolve, 20))

    expect(dispatched).not.toContain('favorites/hydrated')
    expect(recommendationsCalls).toHaveBeenCalledTimes(2)
    subscription.unsubscribe()
  })
})
