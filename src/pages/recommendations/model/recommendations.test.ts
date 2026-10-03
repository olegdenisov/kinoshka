import { favoriteIds, favoriteMovies } from '@features/favorites'
import { watchlistIds } from '@features/watchlist'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import {
  recommendationQuery,
  recommendedMovies,
  retryRecommendations,
} from './recommendations'

const MOVIE_ENDPOINT = '*/v1.5/movie/:id'
const CATALOG_ENDPOINT = '*/v1.5/movie'

const favoriteDoc = (id: number, genre = 'драма', rating = 8) => ({
  id,
  name: `Favorite ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: rating, imdb: 7.9 },
  genres: [{ name: genre }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
})

const catalogDoc = (id: number) => ({
  id,
  name: `Recommended ${id}`,
  year: 2023,
  type: 'movie',
  rating: { kp: 7.2, imdb: 7.0 },
  genres: [{ name: 'драма' }],
  movieLength: 100,
  poster: { previewUrl: 'https://example.com/catalog.jpg' },
})

const error = (status: number) =>
  HttpResponse.json(
    { statusCode: status, message: `Error ${status}`, error: 'Error' },
    { status },
  )

// Фильм избранного по id; статус ошибки — из карты.
const mockFavorites = (statuses: Record<number, number> = {}) => {
  server.use(
    http.get(MOVIE_ENDPOINT, ({ params }) => {
      const id = Number(params.id)
      return statuses[id]
        ? error(statuses[id])
        : HttpResponse.json(favoriteDoc(id))
    }),
  )
}

const mockCatalog = (respond: () => Response) => {
  const requests: URL[] = []
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request }) => {
      requests.push(new URL(request.url))
      return respond()
    }),
  )
  return requests
}

const catalogResponse = (ids: number[]) =>
  HttpResponse.json({
    docs: ids.map(catalogDoc),
    limit: 12,
    next: null,
    hasNext: false,
    hasPrev: false,
    total: ids.length,
  })

describe('recommendationQuery', () => {
  it('пересчитывается только при изменении избранного', async () => {
    mockFavorites()
    favoriteIds.add(1)
    const values: unknown[] = []
    const unsubscribe = recommendationQuery.subscribe(query => {
      values.push(query)
    })
    const unsubscribeMovies = favoriteMovies.subscribe()

    await vi.waitFor(() => expect(recommendationQuery()?.id).toEqual(['!1']))
    const settled = values.length

    // Несвязанный список — подборка не пересчитывается.
    watchlistIds.add(1)
    await vi.waitFor(() =>
      expect(favoriteMovies.status().isPending).toBe(false),
    )
    expect(values).toHaveLength(settled)

    favoriteIds.add(2)
    await vi.waitFor(() =>
      expect(recommendationQuery()?.id).toEqual(['!1', '!2']),
    )
    expect(values).toHaveLength(settled + 1)

    unsubscribe()
    unsubscribeMovies()
  })

  it('пустое избранное → null', () => {
    expect(recommendationQuery()).toBeNull()
  })
})

describe('recommendedMovies', () => {
  it('пустое избранное → null без запроса в каталог', async () => {
    const requests = mockCatalog(() => catalogResponse([]))
    const unsubscribe = recommendedMovies.subscribe()

    await vi.waitFor(() =>
      expect(recommendedMovies.status().isFulfilled).toBe(true),
    )
    expect(recommendedMovies.data()).toBeNull()
    expect(requests).toHaveLength(0)
    unsubscribe()
  })

  it('ждёт избранное и запрашивает каталог один раз по правилу', async () => {
    mockFavorites()
    favoriteIds.add(11)
    const requests = mockCatalog(() => catalogResponse([701]))
    const unsubscribe = recommendedMovies.subscribe()

    await vi.waitFor(() =>
      expect(recommendedMovies.data()?.map(movie => movie.id)).toEqual([701]),
    )
    expect(requests).toHaveLength(1)
    expect(requests[0].searchParams.getAll('id')).toEqual(['!11'])
    unsubscribe()
  })

  it('до загрузки избранного не завершается с null (скелетон, а не empty-state)', async () => {
    mockFavorites()
    favoriteIds.add(12)
    mockCatalog(() => catalogResponse([702]))
    const fulfilledWithNull = vi.fn()
    const unsubscribe = recommendedMovies.status.subscribe(status => {
      if (status.isFulfilled && status.data === null) fulfilledWithNull()
    })

    await vi.waitFor(() => expect(recommendedMovies.data()).toHaveLength(1))
    expect(fulfilledWithNull).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('все избранные 404 → null без запроса в каталог', async () => {
    mockFavorites({ 21: 404, 22: 404 })
    favoriteIds.add(21)
    favoriteIds.add(22)
    const requests = mockCatalog(() => catalogResponse([]))
    const unsubscribe = recommendedMovies.subscribe()

    await vi.waitFor(() =>
      expect(recommendedMovies.status().isFulfilled).toBe(true),
    )
    expect(recommendedMovies.data()).toBeNull()
    expect(requests).toHaveLength(0)
    unsubscribe()
  })

  it('ошибка каталога → retryRecommendations повторяет только каталог', async () => {
    mockFavorites()
    favoriteIds.add(31)
    let attempt = 0
    const requests = mockCatalog(() =>
      ++attempt === 1 ? error(500) : catalogResponse([703]),
    )
    const unsubscribe = recommendedMovies.subscribe()

    await vi.waitFor(() =>
      expect(recommendedMovies.status().isRejected).toBe(true),
    )

    retryRecommendations()

    await vi.waitFor(() =>
      expect(recommendedMovies.data()?.map(movie => movie.id)).toEqual([703]),
    )
    expect(requests).toHaveLength(2)
    unsubscribe()
  })

  it('ошибка избранного → ошибка подборки; retryRecommendations перезапрашивает избранное', async () => {
    let failing = true
    server.use(
      http.get(MOVIE_ENDPOINT, ({ params }) =>
        failing
          ? error(500)
          : HttpResponse.json(favoriteDoc(Number(params.id))),
      ),
    )
    favoriteIds.add(41)
    const requests = mockCatalog(() => catalogResponse([704]))
    const unsubscribe = recommendedMovies.subscribe()

    await vi.waitFor(() =>
      expect(recommendedMovies.status().isRejected).toBe(true),
    )
    expect(requests).toHaveLength(0)

    failing = false
    retryRecommendations()

    await vi.waitFor(() =>
      expect(recommendedMovies.data()?.map(movie => movie.id)).toEqual([704]),
    )
    unsubscribe()
  })
})
