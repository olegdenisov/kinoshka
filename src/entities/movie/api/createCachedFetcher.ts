import { createSessionCache } from "@shared/lib"
import type { Movie } from "../model/types"

type CacheEntry<R> = {
  promise: Promise<R>
  timestamp: number
  isError: boolean
}

const CACHE_TTL_MS = 5 * 60 * 1000 // без изменений
const ERROR_CACHE_TTL_MS = 20 * 1000 // cooldown перед повторным запросом

const isFresh = (timestamp: number, isError: boolean) => {
  const ttl = isError ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS

  return Date.now() - timestamp < ttl
}

const clearUnfreshCache = <R>(cache: Map<string, CacheEntry<R>>) => {
  cache.forEach((entry, key) => {
    if (!isFresh(entry.timestamp, entry.isError)) {
      cache.delete(key)
    }
  })
}

/**
 * Единая пара onSuccess/onError, навешиваемая на `entry.promise` в обеих ветках (replay
 * из sessionStorage и живой fetcher-вызов) — раньше исход промиса разбирался в трёх
 * разных местах (replay-catch, sessionStorage-persist .then, entry-bookkeeping .catch).
 * `persistToSession: false` в replay-ветке — данные уже пришли из sessionStorage,
 * перезаписывать их тем же значением незачем; local-bookkeeping (entry.isError/timestamp)
 * всё равно нужен, плюс сам `.then(...)` обязателен, чтобы rejection не всплыл как
 * unhandled promise rejection.
 */
const attachOutcomeHandlers = <R>(
  entry: CacheEntry<R>,
  sessionCache: ReturnType<typeof createSessionCache<R>>,
  key: string,
  persistToSession: boolean,
) => {
  entry.promise.then(
    (data) => {
      if (persistToSession) {
        sessionCache.set(key, {
          data,
          timestamp: entry.timestamp,
          isError: false,
        })
      }
    },
    (error: unknown) => {
      entry.isError = true

      // timestamp двигаем только когда персистим (живой fetch-вызов) — реплей из
      // sessionStorage не должен продлевать cooldown сверх исходного error-снапшота
      // (иначе повторные in-memory промахи по свежему snapshot незаметно откатывали бы
      // ERROR_CACHE_TTL_MS назад при каждом обращении).
      if (persistToSession) {
        entry.timestamp = Date.now()
        sessionCache.set(key, {
          // data не читается при isError:true (см. ветку replay выше) — значение не имеет значения для R любого вида.
          data: undefined as unknown as R,
          timestamp: entry.timestamp,
          isError: true,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    },
  )
}

/**
 * Регистр всех in-memory кэшей, когда-либо созданных `createCachedFetcher` (включая singleton-
 * фетчеры вроде `getMovies`/`getSearchMovies`/`getMoviesPage`, живущие на уровне модуля). Нужен
 * только для `resetAllCachedFetchers` ниже — тестовой утилиты, сбрасывающей их между тестами
 * (см. `src/test/setup.ts`). Продовое поведение не меняет: сами кэши как были module-level
 * Map'ами, так и остаются, регистр просто держит на них ссылки.
 */
const allCaches: Map<string, CacheEntry<unknown>>[] = []

/**
 * Тестовая утилита (см. `src/test/setup.ts`, вызывается в глобальном `afterEach`): очищает
 * in-memory кэш КАЖДОГО фетчера, созданного через `createCachedFetcher`, включая module-level
 * singleton'ы `getMovies`/`getSearchMovies`/`getMoviesPage`. Без этого тесты в разных файлах
 * (или разные `it` в одном файле), обращающиеся к одному и тому же namespace с одинаковыми
 * параметрами запроса, получали бы кэш-хит с промисом/данными из более раннего теста —
 * до этой правки конвенция избегания коллизий держалась только на том, что каждый тест
 * вручную придумывает уникальный query/набор фильтров (см. комментарии в SearchDesktop.test.tsx
 * / SearchMobile.test.tsx). sessionStorage-персист (см. `createSessionCache`) здесь не трогаем —
 * `beforeEach(() => sessionStorage.clear())` в тестовых файлах уже делает эту часть.
 */
export const resetAllCachedFetchers = (): void => {
  allCaches.forEach((cache) => cache.clear())
}

// R по умолчанию — Movie[] (совместимость getMovies/getSearchMovies без правок сигнатур);
// произвольный R (напр. {movies, totalPages}) — для search/cursor-фетчеров.
export const createCachedFetcher = <P, R = Movie[]>(
  namespace: string,
  fetcher: (params: P) => Promise<R>,
) => {
  const cache = new Map<string, CacheEntry<R>>()
  allCaches.push(cache as Map<string, CacheEntry<unknown>>)
  const sessionCache = createSessionCache<R>(namespace)

  return (params: P): Promise<R> => {
    clearUnfreshCache(cache)

    const key = JSON.stringify(params)
    const cached = cache.get(key)

    if (cached && isFresh(cached.timestamp, cached.isError)) {
      return cached.promise
    }

    const snapshot = sessionCache.get(key)

    if (snapshot && isFresh(snapshot.timestamp, snapshot.isError)) {
      const entry: CacheEntry<R> = {
        promise: snapshot.isError
          ? Promise.reject(
              new Error(snapshot.message ?? "cached error cooldown"),
            )
          : Promise.resolve(snapshot.data),
        timestamp: snapshot.timestamp,
        isError: snapshot.isError,
      }

      attachOutcomeHandlers(entry, sessionCache, key, false)
      cache.set(key, entry)

      return entry.promise
    }

    const entry: CacheEntry<R> = {
      promise: fetcher(params),
      timestamp: Date.now(),
      isError: false,
    }

    attachOutcomeHandlers(entry, sessionCache, key, true)
    cache.set(key, entry)

    return entry.promise
  }
}
