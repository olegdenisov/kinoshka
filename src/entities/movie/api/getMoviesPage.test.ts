import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { hashHue } from '../lib/hashHue'
import { catalogPageStore, type CatalogParams } from './getMoviesPage'

// Механика кеша (дедупликация, TTL, кулдаун) — в createQueryStore.test.ts. Здесь — специфика
// catalogPageStore: обход next 1..N через стор шагов курсора, totalPages из withCount-total.
// Сторы сбрасывает resetAllStores в src/test/setup.ts; мост getMoviesPage держит свой
// module-level pageCache, поэтому его тесты берут свежий модуль.

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
  hue: hashHue(1),
})

const fetchPage = (page: number, params: CatalogParams = {}) =>
  catalogPageStore.fetch({ params, page })

const importBridge = async () => {
  vi.resetModules()
  const mod = await import('./getMoviesPage')
  return {
    getMoviesPage: mod.getMoviesPage,
    invalidate: mod.invalidateMoviesPage,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
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

const forbiddenResponse = () =>
  HttpResponse.json(
    { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
    { status: 403 },
  )

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
        limit: 12,
        next: step.next,
        hasNext: step.next !== null,
        hasPrev: step.cursor !== undefined,
        ...(step.cursor === undefined ? { total } : {}),
      })
    }),
  )

  return counts
}

const mockLastPage = (name: string, total?: number) => {
  const counts = { requests: 0 }
  server.use(
    http.get(ENDPOINT, () => {
      counts.requests += 1
      return HttpResponse.json({
        docs: [doc({ name })],
        limit: 12,
        next: null,
        hasNext: false,
        hasPrev: false,
        ...(total !== undefined ? { total } : {}),
      })
    }),
  )
  return counts
}

const mockForbidden = () => {
  const counts = { requests: 0 }
  server.use(
    http.get(ENDPOINT, () => {
      counts.requests += 1
      return forbiddenResponse()
    }),
  )
  return counts
}

describe('catalogPageStore — page=1 (без курсора)', () => {
  it('запрос уходит без next, с withCount:true', async () => {
    let request: Request | undefined
    server.use(
      http.get(ENDPOINT, ({ request: req }) => {
        request = req
        return HttpResponse.json({
          docs: [doc({ name: 'Page1' })],
          limit: 12,
          next: 'c2',
          hasNext: true,
          hasPrev: false,
          total: 25,
        })
      }),
    )

    const result = await fetchPage(1)

    const url = new URL(request!.url)
    expect(url.searchParams.has('next')).toBe(false)
    expect(url.searchParams.get('withCount')).toBe('true')
    expect(result.movies).toEqual([movieNamed('Page1')])
    expect(result.totalPages).toBe(3)
  })
})

describe('catalogPageStore — обход next 1..N до целевой страницы', () => {
  it('page=3 — 3 запроса (по одному на шаг курсора), результат — доки третьего шага', async () => {
    const counts = mockChain()

    const result = await fetchPage(3)

    expect(counts.requests).toBe(3)
    expect(result.movies).toEqual([movieNamed('Page3')])
  })

  it('withCount только на первом шаге', async () => {
    const withCount: (string | null)[] = []
    server.use(
      http.get(ENDPOINT, ({ request }) => {
        const url = new URL(request.url)
        withCount.push(url.searchParams.get('withCount'))
        const cursor = url.searchParams.get('next')
        const step = CHAIN.find(s => (s.cursor ?? null) === cursor)!
        return HttpResponse.json({
          docs: [doc({ name: step.name })],
          limit: 12,
          next: step.next,
          hasNext: true,
          hasPrev: false,
          total: 25,
        })
      }),
    )

    await fetchPage(2)

    expect(withCount).toEqual(['true', 'false'])
  })

  it('другая страница тех же params переиспользует закешированные шаги курсора', async () => {
    const counts = mockChain()

    await fetchPage(2)
    expect(counts.requests).toBe(2)

    // шаги 1 и 2 — из стора шагов, в сеть уходит только шаг 3
    const page3 = await fetchPage(3)
    expect(counts.requests).toBe(3)
    expect(page3.movies).toEqual([movieNamed('Page3')])

    // page=2 — свежая запись стора страницы, без запросов
    await fetchPage(2)
    expect(counts.requests).toBe(3)
  })

  it('другие params — отдельные шаги курсора', async () => {
    const counts = mockChain()

    await fetchPage(1)
    await fetchPage(1, { 'genres.name': ['drama'] })

    expect(counts.requests).toBe(2)
  })

  it('параллельные запросы одной страницы дают один обход', async () => {
    const counts = mockChain()

    const [first, second] = await Promise.all([fetchPage(3), fetchPage(3)])

    expect(counts.requests).toBe(3)
    expect(first).toBe(second)
  })
})

describe('catalogPageStore — последняя страница и пустая выдача', () => {
  it('курсор заканчивается раньше целевой страницы — movies: [], totalPages всё равно из total', async () => {
    const counts = mockLastPage('Page1', 5)

    const result = await fetchPage(3)

    expect(result.movies).toEqual([])
    expect(result.totalPages).toBe(1)
    // цепочка оборвалась на первом шаге — дальше не ходим
    expect(counts.requests).toBe(1)
  })

  it('последняя страница (next: null на целевом шаге) — доки этого шага', async () => {
    mockLastPage('Last', 12)

    const result = await fetchPage(1)

    expect(result.movies).toEqual([movieNamed('Last')])
    expect(result.totalPages).toBe(1)
  })

  it('total = 0 — totalPages 0', async () => {
    server.use(
      http.get(ENDPOINT, () =>
        HttpResponse.json({
          docs: [],
          limit: 12,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 0,
        }),
      ),
    )

    expect(await fetchPage(1)).toEqual({ movies: [], totalPages: 0 })
  })
})

describe('catalogPageStore — ошибки', () => {
  it('403 — промис реджектится', async () => {
    mockForbidden()

    await expect(fetchPage(1)).rejects.toThrow()
  })

  it('после 403 повторный fetch сразу идёт в сеть (шаг с ошибкой не реплеится) и восстанавливается', async () => {
    const forbidden = mockForbidden()

    await expect(fetchPage(1)).rejects.toThrow()
    expect(forbidden.requests).toBe(1)

    const recovered = mockLastPage('Recovered', 5)

    const result = await fetchPage(1)
    expect(result.movies).toEqual([movieNamed('Recovered')])
    expect(recovered.requests).toBe(1)
  })

  it('падение промежуточного шага: retry перезапрашивает только упавший шаг', async () => {
    const counts = { requests: 0 }
    let failStep2 = true
    server.use(
      http.get(ENDPOINT, ({ request }) => {
        counts.requests += 1
        const cursor = new URL(request.url).searchParams.get('next')
        if (cursor === 'c2' && failStep2) return forbiddenResponse()
        const step = CHAIN.find(s => (s.cursor ?? null) === cursor)!
        return HttpResponse.json({
          docs: [doc({ name: step.name })],
          limit: 12,
          next: step.next,
          hasNext: true,
          hasPrev: false,
          total: 25,
        })
      }),
    )

    await expect(fetchPage(2)).rejects.toThrow()
    expect(counts.requests).toBe(2)

    failStep2 = false
    const result = await fetchPage(2)

    // шаг 1 — из кеша, шаг 2 — заново
    expect(counts.requests).toBe(3)
    expect(result.movies).toEqual([movieNamed('Page2')])
  })
})

describe('catalogPageStore — totalPages = min(10, ceil(total/12)) из withCount-total', () => {
  it('total=115 → totalPages=10 (уже на потолке)', async () => {
    mockLastPage('Test Movie', 115)
    expect((await fetchPage(1)).totalPages).toBe(10)
  })

  it('total=125 → totalPages клампится к demo-потолку 10', async () => {
    mockLastPage('Test Movie', 125)
    expect((await fetchPage(1)).totalPages).toBe(10)
  })

  it('total=15 → totalPages=2', async () => {
    mockLastPage('Test Movie', 15)
    expect((await fetchPage(1)).totalPages).toBe(2)
  })

  it('total отсутствует в ответе (неожиданно) — totalPages = потолок demo-тарифа', async () => {
    mockLastPage('Test Movie')
    expect((await fetchPage(1)).totalPages).toBe(10)
  })
})

// Мост до Task 14 (рекомендации ещё на use())
describe('getMoviesPage / invalidateMoviesPage (мост)', () => {
  it('один и тот же Promise-объект на повторный вызов — стабильность для use()', async () => {
    mockChain()
    const { getMoviesPage } = await importBridge()

    const first = getMoviesPage({}, 3)
    const second = getMoviesPage({}, 3)

    expect(first).toBe(second)
    await first
  })

  it('rejected → invalidate → повторный вызов реально идёт в сеть', async () => {
    const forbidden = mockForbidden()
    const { getMoviesPage, invalidate } = await importBridge()

    await expect(getMoviesPage({}, 1)).rejects.toThrow()
    // без invalidate мост 20 с отдаёт тот же rejected-промис
    await expect(getMoviesPage({}, 1)).rejects.toThrow()
    expect(forbidden.requests).toBe(1)

    invalidate({}, 1)
    const recovered = mockLastPage('Recovered', 5)

    const result = await getMoviesPage({}, 1)
    expect(recovered.requests).toBe(1)
    expect(result.movies).toEqual([movieNamed('Recovered')])
  })
})
