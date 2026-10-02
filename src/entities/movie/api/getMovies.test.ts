import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { hashHue } from '../lib/hashHue'
import { fetchMovies, moviesQueryStore } from './getMovies'

// Механика кэша (дедупликация, TTL, кулдаун) покрыта в createQueryStore.test.ts.
// Здесь — маппинг docs-элемента в Movie и поведение стора на реальных ответах.

const ENDPOINT = '*/v1.5/movie'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Movie',
  year: 2024,
  rating: { kp: 8.1, imdb: 7.9 },
  type: 'movie',
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  ...overrides,
})

const expectedMovie = {
  id: 1,
  title: 'Test Movie',
  year: 2024,
  rating: 8.1,
  type: 'movie',
  genre: ['drama'],
  runtime: '120',
  poster: 'https://example.com/poster.jpg',
  hue: hashHue(1),
}

const mockSuccess = (docs = [doc()]) => {
  server.use(
    http.get(ENDPOINT, () =>
      HttpResponse.json({
        docs,
        total: docs.length,
        page: 1,
        pages: 1,
        limit: 10,
      }),
    ),
  )
}

describe('fetchMovies — маппинг полей', () => {
  it('полностью заполненный docs-элемент маппится в Movie', async () => {
    mockSuccess([doc()])
    const movies = await fetchMovies({ type: ['movie'] })

    expect(movies).toEqual([expectedMovie])
  })

  it('year отсутствует — undefined, а не текущий год', async () => {
    mockSuccess([doc({ year: null })])
    const [movie] = await fetchMovies({ type: ['movie'] })

    expect(movie.year).toBeUndefined()
  })

  it('rating.kp равен 0 — используется 0, а не rating.imdb', async () => {
    mockSuccess([doc({ rating: { kp: 0, imdb: 6.5 } })])
    const [movie] = await fetchMovies({ type: ['movie'] })

    expect(movie.rating).toBe(0)
  })
})

describe('fetchMovies — регресс: sort уже прокидывается без дополнительного кода', () => {
  it('sortField/sortType уходят в query как есть', async () => {
    let request: Request | undefined
    server.use(
      http.get(ENDPOINT, ({ request: req }) => {
        request = req
        return HttpResponse.json({
          docs: [doc()],
          total: 1,
          page: 1,
          pages: 1,
          limit: 10,
        })
      }),
    )
    await fetchMovies({ sortField: ['rating.kp'], sortType: ['-1'] })

    const url = new URL(request!.url)
    expect(url.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url.searchParams.getAll('sortType')).toEqual(['-1'])
  })
})

describe('moviesQueryStore — fetch', () => {
  it('успех — отдаёт Movie[]', async () => {
    mockSuccess([doc()])

    await expect(moviesQueryStore.fetch({ type: ['movie'] })).resolves.toEqual([
      expectedMovie,
    ])
  })

  it('пустой docs — []', async () => {
    mockSuccess([])

    await expect(moviesQueryStore.fetch({ type: ['movie'] })).resolves.toEqual(
      [],
    )
  })

  it('403 — отклоняется ApiError с сообщением о лимите', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Limit reached', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )

    const error = await moviesQueryStore
      .fetch({ type: ['movie'] })
      .catch((e: unknown) => e)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toContain('Limit reached')
  })
})
