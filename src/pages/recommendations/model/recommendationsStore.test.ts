import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { recommendationsStore } from './recommendationsStore'

const MOVIE = (id: number) => `*/v1.5/movie/${id}`
const CATALOG = '*/v1.5/movie'

const favoriteDoc = (id: number) => ({
  id,
  name: `Favorite ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1 },
  genres: [{ name: 'драма' }],
  movieLength: 120,
  persons: [],
  countries: [],
})

const catalogBody = {
  docs: [
    {
      id: 700,
      name: 'Rec',
      year: 2023,
      type: 'movie',
      rating: { kp: 7.2 },
      genres: [{ name: 'драма' }],
      movieLength: 100,
      poster: { previewUrl: 'https://example.com/p.jpg' },
    },
  ],
  limit: 12,
  next: null,
  hasNext: false,
  hasPrev: false,
  total: 1,
}

const mockFavorite = (id: number) => {
  const counter = { requests: 0 }
  server.use(
    http.get(MOVIE(id), () => {
      counter.requests += 1
      return HttpResponse.json(favoriteDoc(id))
    }),
  )
  return counter
}

describe('recommendationsStore', () => {
  it('пустое избранное: null без сетевых запросов', async () => {
    let requests = 0
    server.use(
      http.get(CATALOG, () => {
        requests += 1
        return HttpResponse.json(catalogBody)
      }),
    )

    await expect(recommendationsStore.fetch([])).resolves.toBeNull()
    expect(requests).toBe(0)
  })

  it('успех: цепочка возвращает фильмы каталога', async () => {
    mockFavorite(1)
    server.use(http.get(CATALOG, () => HttpResponse.json(catalogBody)))

    const movies = await recommendationsStore.fetch([1])

    expect(movies?.map(movie => movie.title)).toEqual(['Rec'])
  })

  it('ошибка каталога: Retry перезапрашивает упавший шаг, избранное берётся из кеша', async () => {
    const favorite = mockFavorite(2)
    let catalogRequests = 0
    server.use(
      http.get(CATALOG, () => {
        catalogRequests += 1
        return catalogRequests === 1
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json(catalogBody)
      }),
    )

    await expect(recommendationsStore.fetch([2])).rejects.toThrow()
    expect(catalogRequests).toBe(1)

    const movies = await recommendationsStore.fetch([2])

    expect(movies).toHaveLength(1)
    expect(catalogRequests).toBe(2)
    expect(favorite.requests).toBe(1)
  })

  it('ошибка загрузки избранного (не 404) пробрасывается', async () => {
    server.use(
      http.get(MOVIE(3), () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    await expect(recommendationsStore.fetch([3])).rejects.toThrow()
  })
})
