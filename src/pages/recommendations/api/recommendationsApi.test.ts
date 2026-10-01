import { useFavorites } from '@features/favorites'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper, makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { recommendationsApi } from './recommendationsApi'

type Store = ReturnType<typeof makeStore>

const FAVORITES_KEY = 'kinoshka:favorites'
const CATALOG_ENDPOINT = '*/v1.5/movie'

const { getRecommendations } = recommendationsApi.endpoints

const setFavorites = (ids: number[]) =>
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))

const favoriteDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Favorite ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.0, imdb: 7.9 },
  genres: [{ name: 'драма' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  ...overrides,
})

const catalogDoc = (id: number, name: string) => ({
  id,
  name,
  year: 2023,
  type: 'movie',
  rating: { kp: 7.2, imdb: 7.0 },
  genres: [{ name: 'драма' }],
  movieLength: 100,
  poster: { previewUrl: 'https://example.com/catalog.jpg' },
})

const errorResponse = (status: number) =>
  HttpResponse.json(
    { statusCode: status, message: `Error ${status}`, error: 'Error' },
    { status },
  )

const mockFavorite = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(favoriteDoc(id, overrides)),
    ),
  )
}

// Счётчик и последний URL каталожного запроса: по нему видно и сам перезапрос, и с какими id
// избранного он построен (exclude `!<id>`).
const mockCatalog = (docs: Record<string, unknown>[]) => {
  const requests: URL[] = []
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request }) => {
      requests.push(new URL(request.url))
      return HttpResponse.json({
        docs,
        limit: 12,
        next: null,
        hasNext: false,
        hasPrev: false,
        total: docs.length,
      })
    }),
  )
  return {
    count: () => requests.length,
    lastExcludedIds: () => requests.at(-1)?.searchParams.getAll('id'),
  }
}

const fetchRecommendations = (store: Store = makeStore()) =>
  store.dispatch(getRecommendations.initiate())

const selectEntry = (store: Store) =>
  getRecommendations.select()(store.getState())

// toggle избранного — через публичный хук фичи (mutation toggleFavorite внутри), как в UI.
const renderFavorites = (store: Store) =>
  renderHook(() => useFavorites(), { wrapper: createStoreWrapper(store) })

beforeEach(() => {
  localStorage.clear()
})

describe('getRecommendations', () => {
  it('пустое избранное → null без сетевых запросов', async () => {
    const catalog = mockCatalog([])

    const result = await fetchRecommendations()

    expect(result.data).toBeNull()
    expect(catalog.count()).toBe(0)
  })

  it('успех: фильмы каталога по правилу из избранного', async () => {
    setFavorites([601, 602])
    mockFavorite(601, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(602, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })
    const catalog = mockCatalog([catalogDoc(701, 'Recommended Movie')])

    const result = await fetchRecommendations()

    expect(result.data?.map(movie => movie.title)).toEqual([
      'Recommended Movie',
    ])
    expect(catalog.lastExcludedIds()).toEqual(['!601', '!602'])
  })

  it('все id избранного 404 → null, каталог не запрашивается', async () => {
    setFavorites([801, 802])
    server.use(
      http.get('*/v1.5/movie/801', () => errorResponse(404)),
      http.get('*/v1.5/movie/802', () => errorResponse(404)),
    )
    const catalog = mockCatalog([])

    const result = await fetchRecommendations()

    expect(result.data).toBeNull()
    expect(result.error).toBeUndefined()
    expect(catalog.count()).toBe(0)
  })

  it('ошибка каталога → QueryError со status', async () => {
    setFavorites([901])
    mockFavorite(901)
    server.use(http.get(CATALOG_ENDPOINT, () => errorResponse(500)))

    const result = await fetchRecommendations()

    expect(result.error).toMatchObject({ status: 500 })
  })

  it('восстановимый сбой загрузки избранного → ошибка', async () => {
    setFavorites([902])
    server.use(http.get('*/v1.5/movie/902', () => errorResponse(500)))

    const result = await fetchRecommendations()

    expect(result.error).toMatchObject({
      message: 'Failed to load movies by ids',
    })
  })
})

describe('getRecommendations — инвалидация по тегу Recommendations', () => {
  it('toggleFavorite при активной подписке перезапрашивает рекомендации уже по новым id', async () => {
    setFavorites([601])
    mockFavorite(601)
    mockFavorite(602)
    const catalog = mockCatalog([catalogDoc(701, 'Recommended Movie')])
    const store = makeStore()

    const subscription = fetchRecommendations(store)
    await subscription
    expect(catalog.count()).toBe(1)
    expect(catalog.lastExcludedIds()).toEqual(['!601'])

    const { result } = renderFavorites(store)
    await act(async () => {
      result.current.toggle(602)
    })

    await waitFor(() => expect(catalog.count()).toBe(2))
    expect(catalog.lastExcludedIds()).toEqual(['!601', '!602'])
    await waitFor(() => expect(selectEntry(store).isSuccess).toBe(true))

    subscription.unsubscribe()
  })

  it('без подписчика запись кеша сбрасывается и перезапрашивается при следующем заходе', async () => {
    setFavorites([601])
    mockFavorite(601)
    mockFavorite(602)
    const catalog = mockCatalog([catalogDoc(701, 'Recommended Movie')])
    const store = makeStore()

    const subscription = fetchRecommendations(store)
    await subscription
    // Ушли со страницы: подписчика нет, но keepUnusedDataFor держит запись в кеше.
    subscription.unsubscribe()
    expect(selectEntry(store).isSuccess).toBe(true)

    const { result } = renderFavorites(store)
    await act(async () => {
      result.current.toggle(602)
    })

    // Без подписчика RTK Query не перезапрашивает, а удаляет запись.
    await waitFor(() => expect(selectEntry(store).isUninitialized).toBe(true))
    expect(catalog.count()).toBe(1)

    // Следующий заход на страницу — новый запрос с актуальными id.
    const next = await fetchRecommendations(store)
    expect(next.data).toHaveLength(1)
    expect(catalog.count()).toBe(2)
    expect(catalog.lastExcludedIds()).toEqual(['!601', '!602'])
  })
})
