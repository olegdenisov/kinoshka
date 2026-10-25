import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { seedStorage } from '../../../test/seedStorage'
import { server } from '../../../test/setup'
import { useRecommendedMovies } from './useRecommendedMovies'

const FAVORITES_KEY = 'kinoshka:favorites'
const MOVIE_ENDPOINT = (id: number) => `*/v1.5/movie/${id}`
const CATALOG_ENDPOINT = '*/v1.5/movie'

const favoriteDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Favorite ${id}`,
  alternativeName: `Избранный ${id}`,
  enName: `Favorite ${id} EN`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'драма' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  slogan: 'tagline',
  description: 'synopsis',
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

const mockFavorite = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(MOVIE_ENDPOINT(id), () =>
      HttpResponse.json(favoriteDoc(id, overrides)),
    ),
  )
}

const mockFavoriteNotFound = (id: number) => {
  server.use(
    http.get(MOVIE_ENDPOINT(id), () =>
      HttpResponse.json(
        {
          statusCode: 404,
          message: `Not found movie with id ${id}`,
          error: 'Not Found',
        },
        { status: 404 },
      ),
    ),
  )
}

const mockCatalog = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  let request: Request | undefined
  let requests = 0
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request: req }) => {
      request = req
      requests += 1
      return HttpResponse.json({
        docs,
        limit: 12,
        next: null,
        hasNext: false,
        hasPrev: false,
        total: docs.length,
        ...overrides,
      })
    }),
  )
  return { getRequest: () => request, getRequests: () => requests }
}

describe('useRecommendedMovies', () => {
  it('непустые favorites: возвращает фильмы; запрос содержит id/genres.name/rating.kp правила', async () => {
    seedStorage(FAVORITES_KEY, JSON.stringify([601, 602]))
    mockFavorite(601, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(602, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })
    const { getRequest } = mockCatalog([catalogDoc(701, 'Recommended Movie')])

    const { result } = renderHook(() => useRecommendedMovies())

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map(movie => movie.title)).toEqual([
      'Recommended Movie',
    ])

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.getAll('id')).toEqual(['!601', '!602'])
    expect(url.searchParams.getAll('genres.name')).toEqual(['триллер', 'драма'])
    expect(url.searchParams.getAll('rating.kp')).toEqual(['6.0-10'])
  })

  it('пустое избранное: data === null без единого сетевого запроса', async () => {
    const { getRequests } = mockCatalog([catalogDoc(1, 'Never')])

    const { result } = renderHook(() => useRecommendedMovies())

    await waitFor(() => expect(result.current.data).toBeNull())
    expect(getRequests()).toBe(0)
  })

  it('все favorite id 404-нулись: data === null, каталог не запрашивается', async () => {
    seedStorage(FAVORITES_KEY, JSON.stringify([801, 802]))
    mockFavoriteNotFound(801)
    mockFavoriteNotFound(802)
    const { getRequests } = mockCatalog([])

    const { result } = renderHook(() => useRecommendedMovies())

    await waitFor(() => expect(result.current.data).toBeNull())
    expect(getRequests()).toBe(0)
  })

  it('каталог вернул пусто: data === [] (отличается от null)', async () => {
    seedStorage(FAVORITES_KEY, JSON.stringify([603]))
    mockFavorite(603, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockCatalog([])

    const { result } = renderHook(() => useRecommendedMovies())

    await waitFor(() => expect(result.current.data).toEqual([]))
  })

  it('изменение избранного даёт новый ключ и новый запрос', async () => {
    seedStorage(FAVORITES_KEY, JSON.stringify([603]))
    mockFavorite(603, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(604, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })
    const { getRequests } = mockCatalog([catalogDoc(701, 'Recommended Movie')])

    const { result } = renderHook(() => useRecommendedMovies())
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(getRequests()).toBe(1)

    act(() => {
      seedStorage(FAVORITES_KEY, JSON.stringify([603, 604]))
    })

    await waitFor(() => expect(getRequests()).toBe(2))
    await waitFor(() => expect(result.current.isFetching).toBe(false))
  })
})
