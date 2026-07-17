import { apiClient, type MovieControllerFindManyByQueryV15Data } from "@shared/api";
import type { Movie, MovieType } from "../model/types";
import { createCachedFetcher } from "./createCachedFetcher";

type RequestParams = MovieControllerFindManyByQueryV15Data['query'];

const fetchMovies = async (params: RequestParams): Promise<Movie[]> => {
  const response = await apiClient.getV15Movie({
    query: {
      ...params,
      notNullFields: ['poster.url', 'rating.kp', 'rating.imdb'],
      selectFields: ['id', 'name', 'year', 'rating', 'type', 'genres', 'movieLength', 'poster']
    }
  })

  if (!('docs' in response.data)) { // нужно чтобы сузить тип
    return [];
  }

  const movies = response.data.docs.map((movie) => ({
    id: movie.id || 0,
    title: movie.name || '',
    year: movie.year ?? undefined,
    rating: movie.rating?.kp ?? movie.rating?.imdb ?? 0,
    type: (movie.type || 'movie') as MovieType,
    genre: (movie.genres?.map((genre) => genre.name) || []) as Movie['genre'],
    runtime: String(movie.movieLength ?? 0),
    poster: movie.poster?.previewUrl || '',
    hue: 0,
  }));

  return movies;
}

export const getMovies = createCachedFetcher('movies', fetchMovies)
