import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'

// Механика кэша (дедупликация, TTL, cooldown, sessionStorage) шагов-курсоров покрыта
// в createCachedFetcher.test.ts. Здесь — специфика getMoviesPage: обход next 1..N,
// page-level промис-мемо, вычисление totalPages из withCount-total.

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

const movieNamed = (name: string) => ({
  id: 1,
  title: name,
  year: 2024,
  rating: 8.1,
  type: 'movie',
  genre: ['drama'],
  runtime: '120',
  poster: 'https://example.com/poster.jpg',
  hue: 0,
})

// Свежий модуль на каждый тест — сбрасывает in-memory кэш шагов и page-level кэш,
// чтобы одинаковые (params, page)/(params, cursor) не залипали между тестами.
const importGetMoviesPage = async () => {
  vi.resetModules()
  const mod = await import('./getMoviesPage')
  return mod.getMoviesPage
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

// Цепочка курсоров: старт (без next) → c2 → c3 → c4 (конец списка).
const CHAIN = [
  {
    cursor: undefined as string | undefined,
    name: 'Page1',
    next: 'c2' as string | null,
  },
  { cursor: 'c2', name: 'Page2', next: 'c3' as string | null },
  { cursor: 'c3', name: 'Page3', next: 'c4' as string | null },
]

const mockChain = (total = 25) => {
  const counts = { requests: 0 }

  server.use(
    http.get(ENDPOINT, ({ request }) => {
      counts.requests += 1
      const cursor = new URL(request.url).searchParams.get('next')
      const step = CHAIN.find(s => (s.cursor ?? null) === cursor)

      if (!step) {
        throw new Error(`unexpected cursor: ${cursor}`)
      }

      return HttpResponse.json({
        docs: [doc({ name: step.name })],
        limit: 10,
        next: step.next,
        hasNext: step.next !== null,
        hasPrev: step.cursor !== undefined,
        ...(step.cursor === undefined ? { total } : {}),
      })
    }),
  )

  return counts
}

describe('getMoviesPage — page=1 (без курсора)', () => {
  it('запрос уходит без next, с withCount:true', async () => {
    let request: Request | undefined
    server.use(
      http.get(ENDPOINT, ({ request: req }) => {
        request = req
        return HttpResponse.json({
          docs: [doc({ name: 'Page1' })],
          limit: 10,
          next: 'c2',
          hasNext: true,
          hasPrev: false,
          total: 25,
        })
      }),
    )
    const getMoviesPage = await importGetMoviesPage()

    const result = await getMoviesPage({}, 1)

    const url = new URL(request!.url)
    expect(url.searchParams.has('next')).toBe(false)
    expect(url.searchParams.get('withCount')).toBe('true')
    expect(result.movies).toEqual([movieNamed('Page1')])
    expect(result.totalPages).toBe(3)
  })
})

describe('getMoviesPage — обход next 1..N до целевой страницы', () => {
  it('page=3 — 3 запроса (по одному на курсор-шаг), результат — доки третьего шага', async () => {
    const counts = mockChain()
    const getMoviesPage = await importGetMoviesPage()

    const result = await getMoviesPage({}, 3)

    expect(counts.requests).toBe(3)
    expect(result.movies).toEqual([movieNamed('Page3')])
  })

  it('промежуточные шаги-курсоры кешируются фабрикой — другая страница не дублирует уже пройденные шаги', async () => {
    const counts = mockChain()
    const getMoviesPage = await importGetMoviesPage()

    await getMoviesPage({}, 3)
    expect(counts.requests).toBe(3)

    const page2 = await getMoviesPage({}, 2)

    // шаги 1 и 2 уже в кэше фабрики — новых запросов не было
    expect(counts.requests).toBe(3)
    expect(page2.movies).toEqual([movieNamed('Page2')])
  })
})

describe('getMoviesPage — отсутствие next → пустой хвост', () => {
  it('курсор заканчивается раньше целевой страницы — movies: [], totalPages всё равно из total', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return HttpResponse.json({
          docs: [doc({ name: 'Page1' })],
          limit: 10,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 5,
        })
      }),
    )
    const getMoviesPage = await importGetMoviesPage()

    const result = await getMoviesPage({}, 3)

    expect(result.movies).toEqual([])
    expect(result.totalPages).toBe(1)
    // цепочка оборвалась на первом шаге — дальше не ходим
    expect(requests).toBe(1)
  })
})

describe('getMoviesPage — ошибки', () => {
  it('403 — промис реджектится (пробрасывается наверх, без перехвата)', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )
    const getMoviesPage = await importGetMoviesPage()

    await expect(getMoviesPage({}, 1)).rejects.toThrow()
  })

  it('page-level кеш не залипает на rejected promise навсегда — после истечения нижнего error-cooldown повторный вызов реально идёт в сеть и восстанавливается', async () => {
    const ERROR_CACHE_TTL_MS = 20 * 1000
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)

    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        )
      }),
    )
    const getMoviesPage = await importGetMoviesPage()

    await expect(getMoviesPage({}, 1)).rejects.toThrow()
    expect(requests).toBe(1)

    // Нижний слой (cachedCursorStep) ещё в своём 20s error-cooldown — второй вызов не
    // обязан бить сеть заново прямо сейчас, но критично, что pageCache сам по себе больше
    // не держит мёртвой хваткой один и тот же rejected promise навсегда (баг до фикса —
    // см. следующий шаг после истечения cooldown).
    await expect(getMoviesPage({}, 1)).rejects.toThrow()

    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return HttpResponse.json({
          docs: [doc({ name: 'Recovered' })],
          limit: 10,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 5,
        })
      }),
    )

    now += ERROR_CACHE_TTL_MS + 1

    // Без фикса (pageCache без TTL/eviction) это по-прежнему вернуло бы исходный
    // rejected promise и тест бы упал здесь.
    const result = await getMoviesPage({}, 1)
    expect(result.movies).toEqual([movieNamed('Recovered')])
    expect(requests).toBe(2)
  })
})

describe('getMoviesPage — page-level промис-мемо', () => {
  it('повторный getMoviesPage(params, 3) — без новых запросов (из кеша)', async () => {
    const counts = mockChain()
    const getMoviesPage = await importGetMoviesPage()

    await getMoviesPage({}, 3)
    expect(counts.requests).toBe(3)

    await getMoviesPage({}, 3)
    expect(counts.requests).toBe(3)
  })

  it('идентичность page-level промиса — второй вызов возвращает тот же Promise-объект', async () => {
    mockChain()
    const getMoviesPage = await importGetMoviesPage()

    const first = getMoviesPage({}, 3)
    const second = getMoviesPage({}, 3)

    expect(first).toBe(second)
    await first
  })
})

describe('getMoviesPage — totalPages = min(10, ceil(total/10)) из withCount-total', () => {
  const mockTotal = (total?: number) =>
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({
          docs: [doc()],
          limit: 10,
          next: null,
          hasNext: false,
          hasPrev: false,
          ...(total !== undefined ? { total } : {}),
        }),
      ),
    )

  it('total=95 → totalPages=10 (уже на потолке)', async () => {
    mockTotal(95)
    const getMoviesPage = await importGetMoviesPage()

    expect((await getMoviesPage({}, 1)).totalPages).toBe(10)
  })

  it('total=125 → totalPages клампится к demo-потолку 10', async () => {
    mockTotal(125)
    const getMoviesPage = await importGetMoviesPage()

    expect((await getMoviesPage({}, 1)).totalPages).toBe(10)
  })

  it('total=15 → totalPages=2', async () => {
    mockTotal(15)
    const getMoviesPage = await importGetMoviesPage()

    expect((await getMoviesPage({}, 1)).totalPages).toBe(2)
  })

  it('total отсутствует в ответе (неожиданно) — totalPages = потолок demo-тарифа', async () => {
    mockTotal(undefined)
    const getMoviesPage = await importGetMoviesPage()

    expect((await getMoviesPage({}, 1)).totalPages).toBe(10)
  })
})
