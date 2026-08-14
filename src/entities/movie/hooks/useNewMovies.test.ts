import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import type { getMovies } from '../api/getMovies'

// Механика кэша (TTL/cooldown/sessionStorage) полностью покрыта createCachedFetcher.test.ts.
// Здесь — только то, что invalidateNewMovies бьёт РОВНО по тому же кэш-ключу
// (JSON.stringify(params)), что использует сам хук useNewMovies.
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

// Дублирует форму buildNewMoviesParams из useNewMovies.ts — намеренно (как в
// getMovies.test.ts/getMoviesPage.test.ts): тест должен ломаться, если invalidate
// разойдётся по ключу с тем, что реально использует хук.
const newMoviesParams = (params?: {
  type?: NonNullable<Parameters<typeof getMovies>[0]>['type']
}): Parameters<typeof getMovies>[0] => ({
  ...params,
  year: [new Date().getFullYear().toString()],
})

const importModules = async () => {
  vi.resetModules()
  const [{ invalidateNewMovies }, { getMovies }] = await Promise.all([
    import('./useNewMovies'),
    import('../api/getMovies'),
  ])
  return { invalidateNewMovies, getMovies }
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('invalidateNewMovies', () => {
  it('после rejected getMovies(newMoviesParams({ type: ["tv-series"] })) → invalidate() → повторный вызов реально идёт в сеть', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return errorResponse()
      }),
    )
    const { invalidateNewMovies, getMovies } = await importModules()

    await expect(
      getMovies(newMoviesParams({ type: ['tv-series'] })),
    ).rejects.toThrow()
    expect(requests).toBe(1)

    invalidateNewMovies({ type: ['tv-series'] })

    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return successResponse([doc({ name: 'Recovered' })])
      }),
    )

    await getMovies(newMoviesParams({ type: ['tv-series'] }))
    expect(requests).toBe(2)
  })

  it("invalidateNewMovies({ type: ['tv-series'] }) не задевает независимую запись без type", async () => {
    server.use(http.get(ENDPOINT, () => successResponse()))
    const { invalidateNewMovies, getMovies } = await importModules()

    await getMovies(newMoviesParams())
    await getMovies(newMoviesParams({ type: ['tv-series'] }))

    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return successResponse()
      }),
    )

    invalidateNewMovies({ type: ['tv-series'] })

    // без type — по-прежнему в кэше, новый запрос не уходит
    await getMovies(newMoviesParams())
    expect(requests).toBe(0)

    // с type: ['tv-series'] — инвалидирован, реальный новый запрос
    await getMovies(newMoviesParams({ type: ['tv-series'] }))
    expect(requests).toBe(1)
  })

  it('invalidate на несуществующих params — no-op, не бросает', async () => {
    const { invalidateNewMovies } = await importModules()

    expect(() => invalidateNewMovies({ type: ['cartoon'] })).not.toThrow()
  })
})
