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
  
  if (response.status !== 200) {
    throw new Error(response.statusText)
  }

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
    hue: 0,
  })) ?? [];

  return movies;
}

type CacheEntry = { promise: Promise<Movie[]>; timestamp: number }

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const cache = new Map<string, CacheEntry>()

export const getMovies = (params: RequestParams): Promise<Movie[]> => {
  const key = JSON.stringify(params)
  const cached = cache.get(key)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) { 
    return cached.promise
  }

  const promise = fetchMovies(params)
  
  promise.catch(() => cache.delete(key))
  cache.set(key, { promise, timestamp: Date.now() })
  
  return promise
}