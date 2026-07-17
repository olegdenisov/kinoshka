import { apiClient } from "@shared/api";
import type { Movie, MovieType } from "../model/types";
import { createCachedFetcher } from "./createCachedFetcher";

type RequestParams = {
  query: string;
  page?: number;
}

const fetchSearchMovies = async (query: RequestParams): Promise<Movie[]> => {
  const response = await apiClient.getV14MovieSearch({
      query: {
        ...query
      }
    })

    if (!('docs' in response.data)) {
      return [];
    }

    const movies = response.data.docs.map((movie) => ({
      id: movie.id || 0,
      title: movie.name || movie.alternativeName || movie.enName || '',
      year: movie.year || undefined,
      rating: movie.rating?.kp ?? movie.rating?.imdb ?? 0,
      type: (movie.type || 'movie') as MovieType,
      genre: (movie.genres?.map((genre) => genre.name) || []) as Movie['genre'],
      runtime: String(movie.movieLength ?? 0),
      poster: movie.poster?.previewUrl || '',
      hue: 0,
    })) ?? [];

    return movies;
}

export const getSearchMovies = createCachedFetcher('search', fetchSearchMovies)
