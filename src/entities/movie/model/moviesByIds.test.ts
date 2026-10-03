import { reatomSet } from '@reatom/core'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { reatomMoviesByIds } from './moviesByIds'

const doc = (id: number) => ({
  id,
  name: `Movie ${id}`,
  alternativeName: null,
  enName: null,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  slogan: null,
  description: null,
})

// Один хендлер на все id: статус по id из карты, остальные — 200. Счётчик — по id.
const mockMovies = (statuses: Record<number, number> = {}) => {
  const requests = vi.fn<(id: number) => void>()
  server.use(
    http.get('*/v1.5/movie/:id', ({ params }) => {
      const id = Number(params.id)
      requests(id)
      const status = statuses[id]
      if (status) {
        return HttpResponse.json(
          { statusCode: status, message: `Error ${status}`, error: 'Error' },
          { status },
        )
      }
      return HttpResponse.json(doc(id))
    }),
  )
  return requests
}

const setup = (initial: number[]) => {
  const ids = reatomSet<number>(initial, 'test.ids')
  const movies = reatomMoviesByIds(ids, 'test.moviesByIds')
  const unsubscribe = movies.subscribe()
  return { ids, movies, unsubscribe }
}

describe('reatomMoviesByIds', () => {
  it('фильмы в порядке набора id', async () => {
    mockMovies()
    const { movies, unsubscribe } = setup([3, 1, 2])

    await vi.waitFor(() =>
      expect(movies.data().map(movie => movie.id)).toEqual([3, 1, 2]),
    )
    unsubscribe()
  })

  it('пустой набор — [] без запросов', async () => {
    const requests = mockMovies()
    const { movies, unsubscribe } = setup([])

    await vi.waitFor(() => expect(movies.status().isFulfilled).toBe(true))
    expect(movies.data()).toEqual([])
    expect(requests).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('404 одного id не роняет список — id выпадает', async () => {
    mockMovies({ 302: 404 })
    const { movies, unsubscribe } = setup([301, 302, 303])

    await vi.waitFor(() =>
      expect(movies.data().map(movie => movie.id)).toEqual([301, 303]),
    )
    expect(movies.error()).toBeUndefined()
    unsubscribe()
  })

  it('все id 404 — пустой список без ошибки', async () => {
    mockMovies({ 501: 404, 502: 404 })
    const { movies, unsubscribe } = setup([501, 502])

    await vi.waitFor(() => expect(movies.status().isFulfilled).toBe(true))
    expect(movies.data()).toEqual([])
    expect(movies.error()).toBeUndefined()
    unsubscribe()
  })

  it('все id 5xx — ошибка, а не тихий пустой список', async () => {
    mockMovies({ 601: 500, 602: 500 })
    const { movies, unsubscribe } = setup([601, 602])

    await vi.waitFor(() => expect(movies.status().isRejected).toBe(true))
    expect(movies.error()?.message).toBe('Failed to load movies by ids')
    unsubscribe()
  })

  it('смена набора не шлёт запросов за уже загруженными фильмами', async () => {
    const requests = mockMovies()
    const { ids, movies, unsubscribe } = setup([1, 2])

    await vi.waitFor(() => expect(movies.data()).toHaveLength(2))
    expect(requests).toHaveBeenCalledTimes(2)

    ids.add(3)
    await vi.waitFor(() =>
      expect(movies.data().map(movie => movie.id)).toEqual([1, 2, 3]),
    )
    ids.delete(1)
    await vi.waitFor(() =>
      expect(movies.data().map(movie => movie.id)).toEqual([2, 3]),
    )
    ids.add(1)
    await vi.waitFor(() =>
      expect(movies.data().map(movie => movie.id)).toEqual([2, 3, 1]),
    )

    expect(requests.mock.calls.map(([id]) => id)).toEqual([1, 2, 3])
    unsubscribe()
  })
})
