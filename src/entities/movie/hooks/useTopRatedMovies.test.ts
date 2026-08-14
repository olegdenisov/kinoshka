import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import type { getMovies } from '../api/getMovies'

// Механика кэша (TTL/cooldown/sessionStorage) полностью покрыта createCachedFetcher.test.ts.
// Здесь — только то, что invalidateTopRatedMovies бьёт РОВНО по тому же кэш-ключу
// (JSON.stringify(params)), что использует сам хук useTopRatedMovies — иначе Retry на рейле
// молча продолжал бы отдавать старый rejected-промис из cooldown.
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

const successResponse = (docs = [doc()]) =>
  HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10 })

const errorResponse = () =>
  HttpResponse.json(
    { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
    { status: 403 },
  )

// Дублирует форму buildTopRatedParams из useTopRatedMovies.ts — намеренно (как в
// getMovies.test.ts/getMoviesPage.test.ts): тест должен ломаться, если invalidate
// разойдётся по ключу с тем, что реально использует хук.
const topRatedParams = (params?: {
  type?: NonNullable<Parameters<typeof getMovies>[0]>['type']
}): Parameters<typeof getMovies>[0] => ({
  sortField: ['rating.kp'],
  'rating.kp': ['7-10'],
  sortType: ['-1'],
  type: params?.type,
})

const importModules = async () => {
  vi.resetModules()
  const [{ invalidateTopRatedMovies }, { getMovies }] = await Promise.all([
    import('./useTopRatedMovies'),
    import('../api/getMovies'),
  ])
  return { invalidateTopRatedMovies, getMovies }
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('invalidateTopRatedMovies', () => {
  it('после rejected getMovies(topRatedParams()) → invalidate() → повторный вызов реально идёт в сеть', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return errorResponse()
      }),
    )
    const { invalidateTopRatedMovies, getMovies } = await importModules()

    await expect(getMovies(topRatedParams())).rejects.toThrow()
    expect(requests).toBe(1)

    invalidateTopRatedMovies()

    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return successResponse([doc({ name: 'Recovered' })])
      }),
    )

    await getMovies(topRatedParams())
    expect(requests).toBe(2)
  })

  it('invalidateTopRatedMovies({ type }) бьёт по своему ключу, не задевая вызов без type', async () => {
    server.use(http.get(ENDPOINT, () => successResponse()))
    const { invalidateTopRatedMovies, getMovies } = await importModules()

    await getMovies(topRatedParams())
    await getMovies(topRatedParams({ type: ['anime'] }))

    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return successResponse()
      }),
    )

    invalidateTopRatedMovies({ type: ['anime'] })

    // без type — по-прежнему в кэше, новый запрос не уходит
    await getMovies(topRatedParams())
    expect(requests).toBe(0)

    // с type: ['anime'] — инвалидирован, реальный новый запрос
    await getMovies(topRatedParams({ type: ['anime'] }))
    expect(requests).toBe(1)
  })

  it('invalidate на несуществующих params — no-op, не бросает', async () => {
    const { invalidateTopRatedMovies } = await importModules()

    expect(() => invalidateTopRatedMovies({ type: ['cartoon'] })).not.toThrow()
  })
})
