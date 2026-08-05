import { apiClient } from "@shared/api";
import type { Movie } from "../model/types";
import { createCachedFetcher } from "./createCachedFetcher";
import { mapDocToMovie } from "./mapDocToMovie";

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

    return response.data.docs.map(mapDocToMovie);
}

export const getSearchMovies = createCachedFetcher('search', fetchSearchMovies)
