import { apiClient, type MovieControllerFindManyByQueryV15Data } from "@shared/api";
import { createSessionCache } from "@shared/lib";
import type { Movie, MovieType } from "../model/types";

type RequestParams = MovieControllerFindManyByQueryV15Data['query'];

const fetchMovies = async (params: RequestParams): Promise<Movie[]> => {
  const response = await apiClient.getV15Movie({ 
    query: {
      ...params,
      notNullFields: ['poster.url', 'rating.kp', 'rating.imdb'],
      selectFields: ['id', 'name', 'year', 'rating', 'type', 'genres', 'movieLength', 'poster']
    }
  })

  if (!('docs' in response.data)) {
    return [];
  }

  const movies = response.data.docs.map((movie) => ({
    id: movie.id || 0,
    title: movie.name || '',
    year: movie.year || new Date().getFullYear(),
    rating: movie.rating?.kp ? movie.rating.kp : movie.rating?.imdb || 0,
    type: (movie.type || 'movie') as MovieType,
    genre: (movie.genres?.map((genre) => genre.name) || []) as Movie['genre'],
    runtime: String(movie.movieLength ?? 0),
    poster: movie.poster?.previewUrl || '',
    hue: 0,
  })) ?? [];

  return movies;
}

type CacheEntry = { promise: Promise<Movie[]>; timestamp: number; isError: boolean }

 const CACHE_TTL_MS = 5 * 60 * 1000       // без изменений
 const ERROR_CACHE_TTL_MS = 20 * 1000     // новая константа — cooldown перед повторным запросом
 const cache = new Map<string, CacheEntry>()
 const sessionCache = createSessionCache<Movie[]>('movies')

const isFresh = (timestamp: number, isError: boolean) => {
  const ttl = isError ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS

  return Date.now() - timestamp < ttl
}

export const getMovies = (params: RequestParams): Promise<Movie[]> => {
  const key = JSON.stringify(params)
  const cached = cache.get(key)

  if (cached && isFresh(cached.timestamp, cached.isError)) {
    return cached.promise
  }

  const snapshot = sessionCache.get(key)

  if (snapshot && isFresh(snapshot.timestamp, snapshot.isError)) {
    const entry: CacheEntry = {
      promise: snapshot.isError ? Promise.reject(new Error('cached rate-limit cooldown')) : Promise.resolve(snapshot.data),
      timestamp: snapshot.timestamp,
      isError: snapshot.isError,
    }

    entry.promise.catch(() => entry.isError = true)
    cache.set(key, entry)

    return entry.promise
  }

  const entry: CacheEntry = {
    promise: fetchMovies(params),
    timestamp: Date.now(),
    isError: false
  }

  entry.promise.then(
    (data) => sessionCache.set(key, { data, timestamp: entry.timestamp, isError: false }),
    () => sessionCache.set(key, { data: [], timestamp: entry.timestamp, isError: true }),
  )
  entry.promise.catch(() => entry.isError = true)
  cache.set(key, entry)

  return entry.promise
}