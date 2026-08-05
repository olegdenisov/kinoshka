import { createSessionCache } from "@shared/lib";
import type { Movie } from "../model/types";

type CacheEntry<R> = { promise: Promise<R>; timestamp: number; isError: boolean }

const CACHE_TTL_MS = 5 * 60 * 1000       // без изменений
const ERROR_CACHE_TTL_MS = 20 * 1000     // cooldown перед повторным запросом

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

// R по умолчанию — Movie[] (совместимость getMovies/getSearchMovies без правок сигнатур);
// произвольный R (напр. {movies, totalPages}) — для search/cursor-фетчеров.
export const createCachedFetcher = <P, R = Movie[]>(
  namespace: string,
  fetcher: (params: P) => Promise<R>,
) => {
  const cache = new Map<string, CacheEntry<R>>()
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
          ? Promise.reject(new Error(snapshot.message ?? 'cached error cooldown'))
          : Promise.resolve(snapshot.data),
        timestamp: snapshot.timestamp,
        isError: snapshot.isError,
      }

      entry.promise.catch(() => entry.isError = true
      )
      cache.set(key, entry)

      return entry.promise
    }

    const entry: CacheEntry<R> = {
      promise: fetcher(params),
      timestamp: Date.now(),
      isError: false
    }

    entry.promise.then(
      (data) => sessionCache.set(key, { data, timestamp: entry.timestamp, isError: false }),
      (error) => sessionCache.set(key, {
        // data не читается при isError:true (см. ветку replay выше) — значение не имеет значения для R любого вида.
        data: undefined as unknown as R,
        timestamp: Date.now(),
        isError: true,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    entry.promise.catch(() => {
      entry.timestamp = Date.now()
      entry.isError = true
    })
    cache.set(key, entry)

    return entry.promise
  }
}
