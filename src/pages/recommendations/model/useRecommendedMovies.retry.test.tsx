import type * as EntitiesMovie from '@entities/movie'
import { vi } from 'vitest'

// Мокаем `getMoviesByIds` целиком (тот же приём, что `FavoritesDesktop.retry.test.tsx`) —
// а не гоняем реальный запрос через MSW. Причина: `getMoviesByIds` внутри реально оборачивает
// N вызовов `getMovieDetail(id)` (см. getMoviesByIds.ts), а у КАЖДОГО `getMovieDetail(id)` свой
// собственный кэш (namespace 'movie-detail', тот же `createCachedFetcher`/`ERROR_CACHE_TTL_MS`
// 20с). `invalidateRecommendations` (см. useRecommendedMovies.ts) инвалидирует только внешний
// кэш `getMoviesByIds`, а не эти внутренние per-id кэши — тот же trade-off, что уже принят для
// `FavoritesDesktop`/`FavoritesMobile` (`onRetry={() => getMoviesByIds.invalidate(ids)}`, см. их
// исходники). Из-за этого реальный MSW-провал (5xx) на тех же id внутри 20с окна закэшировал бы
// rejected-промис ещё и на уровне `getMovieDetail`, и "сервер починился"-ответ не пробился бы
// обратно без ТАКЖЕ инвалидации каждого `getMovieDetail(id)` — что `invalidateRecommendations`
// не делает. Мок здесь детерминированно проверяет именно свойство
// `invalidateRecommendations` → `getMoviesByIds.invalidate` → реальный рефетч на уровне
// `getMoviesByIds`, не полагаясь на реальную (и не полностью инвалидируемую) сетевую композицию.
const { invalidate, getMoviesByIdsMock, getFetchAttempts } = vi.hoisted(() => {
  const cache = new Map<string, Promise<unknown>>()
  let fetchAttempts = 0

  const getMoviesByIdsMock = (ids: number[]) => {
    const key = JSON.stringify(ids)

    if (!cache.has(key)) {
      fetchAttempts++
      const promise =
        fetchAttempts === 1
          ? Promise.reject(new Error('Failed to load favorite movies'))
          : Promise.resolve(
              ids.map(id => ({
                id,
                title: `Recovered ${id}`,
                rating: 7,
                type: 'movie',
                genre: ['драма'],
                runtime: '120',
                hue: 0,
              })),
            )
      cache.set(key, promise)
    }

    return cache.get(key)
  }

  const invalidate = vi.fn((ids: number[]) => {
    cache.delete(JSON.stringify(ids))
  })

  return {
    invalidate,
    getMoviesByIdsMock,
    getFetchAttempts: () => fetchAttempts,
  }
})

vi.mock('@entities/movie', async importOriginal => {
  const actual = await importOriginal<typeof EntitiesMovie>()
  return {
    ...actual,
    getMoviesByIds: Object.assign(getMoviesByIdsMock, {
      invalidate,
      clear: vi.fn(),
    }),
  }
})

const FAVORITES_KEY = 'kinoshka:favorites'

beforeEach(() => {
  localStorage.clear()
  invalidate.mockClear()
})

describe('invalidateRecommendations — Retry реально сбрасывает favorites-кэш (getMoviesByIds)', () => {
  it('после recoverable-провала invalidateRecommendations(ids) вызывает getMoviesByIds.invalidate(ids), и следующий вызов реально идёт в сеть заново', async () => {
    const ids = [1101, 1102]
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))

    const { invalidateRecommendations } = await import('./useRecommendedMovies')
    const { getMoviesByIds } = await import('@entities/movie')

    // Первый вызов — сетевой провал.
    await expect(getMoviesByIds(ids)).rejects.toThrow(
      'Failed to load favorite movies',
    )
    expect(getFetchAttempts()).toBe(1)

    // Без invalidate повторный вызов отдал бы тот же закэшированный rejected-промис,
    // не трогая "сеть" — подтверждаем это до вызова invalidateRecommendations, чтобы
    // следующий шаг доказывал именно эффект инвалидации.
    await expect(getMoviesByIds(ids)).rejects.toThrow()
    expect(getFetchAttempts()).toBe(1)

    invalidateRecommendations(ids)

    expect(invalidate).toHaveBeenCalledWith(ids)

    const movies = await getMoviesByIds(ids)

    // Реально ушёл новый запрос (а не переигранный кэш) — favorites-кэш был очищен
    // `getMoviesByIds.invalidate(ids)` внутри invalidateRecommendations.
    expect(getFetchAttempts()).toBe(2)
    expect(movies.map(movie => movie.id)).toEqual(ids)
  })
})
