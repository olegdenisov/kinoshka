import { apiClient } from "@shared/api";
import type { Movie } from "../model/types";
import { createCachedFetcher } from "./createCachedFetcher";
import { mapDocToMovie } from "./mapDocToMovie";

type RequestParams = {
  query: string;
  page?: number;
}

export type SearchMoviesResult = {
  movies: Movie[];
  totalPages: number;
}

// demo-тариф: страницы 1–10 — clamp totalPages к потолку
const MAX_PAGES = 10

const fetchSearchMovies = async (params: RequestParams): Promise<SearchMoviesResult> => {
  const response = await apiClient.getV14MovieSearch({
      query: {
        ...params,
        limit: 10,
      }
    })

    if (!('docs' in response.data)) {
      return { movies: [], totalPages: 0 };
    }

    return {
      movies: response.data.docs.map(mapDocToMovie),
      totalPages: Math.min(MAX_PAGES, response.data.pages),
    };
}

export const getSearchMovies = createCachedFetcher('search', fetchSearchMovies)
