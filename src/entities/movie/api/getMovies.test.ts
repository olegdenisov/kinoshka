import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'

// Механика кэша (дедупликация, TTL, cooldown, sessionStorage) покрыта в createCachedFetcher.test.ts.
// Здесь — только getMovies-специфика: маппинг docs-элемента в Movie.

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
  hue: 0,
}

const mockSuccess = (docs = [doc()]) => {
  server.use(
    http.get(ENDPOINT, () =>
      HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10 }),
    ),
  )
}

// Свежий модуль на каждый тест — сбрасывает in-memory кэш, чтобы одинаковые params не залипали между тестами.
const importGetMovies = async () => {
  vi.resetModules()
  const mod = await import('./getMovies')
  return mod.getMovies
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('getMovies — маппинг полей', () => {
  it('полностью заполненный docs-элемент маппится в Movie', async () => {
    mockSuccess([doc()])
    const getMovies = await importGetMovies()

    const movies = await getMovies({ type: ['movie'] })

    expect(movies).toEqual([expectedMovie])
  })

  it('year отсутствует — undefined, а не текущий год', async () => {
    mockSuccess([doc({ year: null })])
    const getMovies = await importGetMovies()

    const [movie] = await getMovies({ type: ['movie'] })

    expect(movie.year).toBeUndefined()
  })

  it('rating.kp равен 0 — используется 0, а не rating.imdb', async () => {
    mockSuccess([doc({ rating: { kp: 0, imdb: 6.5 } })])
    const getMovies = await importGetMovies()

    const [movie] = await getMovies({ type: ['movie'] })

    expect(movie.rating).toBe(0)
  })
})

describe('getMovies — регресс: sort уже прокидывается без дополнительного кода', () => {
  it('sortField/sortType уходят в query как есть', async () => {
    let request: Request | undefined
    server.use(
      http.get(ENDPOINT, ({ request: req }) => {
        request = req
        return HttpResponse.json({ docs: [doc()], total: 1, page: 1, pages: 1, limit: 10 })
      }),
    )
    const getMovies = await importGetMovies()

    await getMovies({ sortField: ['rating.kp'], sortType: ['-1'] })

    const url = new URL(request!.url)
    expect(url.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url.searchParams.getAll('sortType')).toEqual(['-1'])
  })
})
