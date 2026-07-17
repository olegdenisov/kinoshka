import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'

const ENDPOINT = '*/v1.5/movie'

// Мирроят TTL-константы из getMovies.ts — при их изменении там нужно поправить и здесь.
const CACHE_TTL_MS = 5 * 60 * 1000
const ERROR_CACHE_TTL_MS = 20 * 1000

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

const mockSuccess = (counter: { count: number }, docs = [doc()]) => {
  server.use(
    http.get(ENDPOINT, () => {
      counter.count += 1
      return HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10 })
    }),
  )
}

const mockForbidden = (counter: { count: number }) => {
  server.use(
    http.get(ENDPOINT, () => {
      counter.count += 1
      return HttpResponse.json({ statusCode: 403, message: 'Forbidden', error: 'Forbidden' }, { status: 403 })
    }),
  )
}

const importGetMovies = async () => {
  vi.resetModules()
  const mod = await import('./getMovies')
  return mod.getMovies
}

let now = 1_000_000

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('getMovies — in-memory кэш', () => {
  it('Дедупликация — параллельные вызовы с одинаковыми params делают один сетевой запрос', async () => {
    const counter = { count: 0 }
    mockSuccess(counter)
    const getMovies = await importGetMovies()
    const params = { type: ['movie' as const] }

    const [a, b] = await Promise.all([getMovies(params), getMovies(params)])

    expect(counter.count).toBe(1)
    expect(a).toEqual([expectedMovie])
    expect(b).toEqual([expectedMovie])
  })

  it('В пределах TTL — повторный вызов после resolve не делает новый запрос', async () => {
    const counter = { count: 0 }
    mockSuccess(counter)
    const getMovies = await importGetMovies()
    const params = { type: ['movie' as const] }

    await getMovies(params)
    await getMovies(params)

    expect(counter.count).toBe(1)
  })

  it('После истечения TTL — повторный вызов делает новый сетевой запрос', async () => {
    const counter = { count: 0 }
    mockSuccess(counter)
    const getMovies = await importGetMovies()
    const params = { type: ['movie' as const] }

    await getMovies(params)
    now += CACHE_TTL_MS + 1
    await getMovies(params)

    expect(counter.count).toBe(2)
  })

  it('Разные params — не используют общий кэш', async () => {
    const counter = { count: 0 }
    mockSuccess(counter)
    const getMovies = await importGetMovies()

    await getMovies({ type: ['movie'] })
    await getMovies({ type: ['tv-series'] })

    expect(counter.count).toBe(2)
  })
})

describe('getMovies — маппинг полей', () => {
  it('year отсутствует — undefined, а не текущий год', async () => {
    const counter = { count: 0 }
    mockSuccess(counter, [doc({ year: null })])
    const getMovies = await importGetMovies()

    const [movie] = await getMovies({ type: ['movie'] })

    expect(movie.year).toBeUndefined()
  })

  it('rating.kp равен 0 — используется 0, а не rating.imdb', async () => {
    const counter = { count: 0 }
    mockSuccess(counter, [doc({ rating: { kp: 0, imdb: 6.5 } })])
    const getMovies = await importGetMovies()

    const [movie] = await getMovies({ type: ['movie'] })

    expect(movie.rating).toBe(0)
  })
})

describe('getMovies — cooldown при 403', () => {
  it('403 — промис реджектится', async () => {
    const counter = { count: 0 }
    mockForbidden(counter)
    const getMovies = await importGetMovies()

    await expect(getMovies({ type: ['movie'] })).rejects.toThrow()
  })

  it('В пределах cooldown — повторный вызов не делает новый запрос и снова реджектится', async () => {
    const counter = { count: 0 }
    mockForbidden(counter)
    const getMovies = await importGetMovies()
    const params = { type: ['movie' as const] }

    await expect(getMovies(params)).rejects.toThrow()
    await expect(getMovies(params)).rejects.toThrow()

    expect(counter.count).toBe(1)
  })

  it('После истечения cooldown — повторный вызов делает новый сетевой запрос', async () => {
    const counter = { count: 0 }
    mockForbidden(counter)
    const getMovies = await importGetMovies()
    const params = { type: ['movie' as const] }

    await expect(getMovies(params)).rejects.toThrow()
    now += ERROR_CACHE_TTL_MS + 1
    await expect(getMovies(params)).rejects.toThrow()

    expect(counter.count).toBe(2)
  })

  it('Реджект несёт реальное сообщение ошибки сервера, а не generic-текст', async () => {
    const counter = { count: 0 }
    mockForbidden(counter)
    const getMovies = await importGetMovies()

    await expect(getMovies({ type: ['movie'] })).rejects.toThrow('Forbidden')
  })

  it('В пределах cooldown — реджект из in-memory кэша тоже несёт реальное сообщение', async () => {
    const counter = { count: 0 }
    mockForbidden(counter)
    const getMovies = await importGetMovies()
    const params = { type: ['movie' as const] }

    await expect(getMovies(params)).rejects.toThrow('Forbidden')
    await expect(getMovies(params)).rejects.toThrow('Forbidden')
  })
})

describe('getMovies — dev-кэш в sessionStorage переживает reload/HMR', () => {
  it('Успешный ответ — восстанавливается из sessionStorage без нового запроса после «перезагрузки» модуля', async () => {
    const counter = { count: 0 }
    mockSuccess(counter)
    const params = { type: ['movie' as const] }

    const firstGetMovies = await importGetMovies()
    const first = await firstGetMovies(params)

    // Эмуляция reload/HMR: модуль (и его in-memory Map) пересоздаётся, sessionStorage — нет.
    const secondGetMovies = await importGetMovies()
    const second = await secondGetMovies(params)

    expect(counter.count).toBe(1)
    expect(second).toEqual(first)
  })

  it('403-cooldown — восстанавливается из sessionStorage без нового запроса после «перезагрузки» модуля', async () => {
    const counter = { count: 0 }
    mockForbidden(counter)
    const params = { type: ['movie' as const] }

    const firstGetMovies = await importGetMovies()
    await expect(firstGetMovies(params)).rejects.toThrow()

    const secondGetMovies = await importGetMovies()
    await expect(secondGetMovies(params)).rejects.toThrow()

    expect(counter.count).toBe(1)
  })

  it('403-cooldown — восстановленный из sessionStorage реджект несёт реальное сообщение, а не generic-текст', async () => {
    const counter = { count: 0 }
    mockForbidden(counter)
    const params = { type: ['movie' as const] }

    const firstGetMovies = await importGetMovies()
    await expect(firstGetMovies(params)).rejects.toThrow('Forbidden')

    const secondGetMovies = await importGetMovies()
    await expect(secondGetMovies(params)).rejects.toThrow('Forbidden')

    expect(counter.count).toBe(1)
  })

  it('Истёкший sessionStorage-снапшот игнорируется — после «перезагрузки» и истечения TTL уходит новый запрос', async () => {
    const counter = { count: 0 }
    mockSuccess(counter)
    const params = { type: ['movie' as const] }

    const firstGetMovies = await importGetMovies()
    await firstGetMovies(params)

    now += CACHE_TTL_MS + 1
    const secondGetMovies = await importGetMovies()
    await secondGetMovies(params)

    expect(counter.count).toBe(2)
  })
})
