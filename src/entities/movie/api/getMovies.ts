import { apiClient, type MovieControllerFindManyByQueryV14Data } from "@shared/api";
import type { Movie, MovieType } from "../model/types";

type RequestParams = MovieControllerFindManyByQueryV14Data['query'];

const fetchMovies = async (params: RequestParams): Promise<Movie[]> => {
  const response = await apiClient.getV15Movie({ 
    query: {
      ...params,
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
    rating: movie.rating?.kp || 0,
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

export const getMovies = (params: RequestParams): Promise<Movie[]> => {
  const key = JSON.stringify(params)
  const cached = cache.get(key)
  const ttl = cached?.isError ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS
  
  if (cached && Date.now() - cached.timestamp < ttl) { 
    return cached.promise
  }

  const entry:CacheEntry = {
    promise: fetchMovies(params),
    timestamp: Date.now(),
    isError: false
  }
  
  entry.promise.catch(() => entry.isError = true)
  cache.set(key, entry)
  
  return entry.promise
}