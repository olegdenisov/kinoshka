import { apiClient } from '@shared/api'
import type { Movie } from '../model/types'
import { createCachedFetcher } from './createCachedFetcher'
import { mapDocToMovie } from './mapDocToMovie'
import { PER_PAGE, MAX_PAGES } from './paginationConfig'

type RequestParams = {
  query: string
  page?: number
}

export type SearchMoviesResult = {
  movies: Movie[]
  totalPages: number
}

const fetchSearchMovies = async (
  params: RequestParams,
): Promise<SearchMoviesResult> => {
  const response = await apiClient.getV15MovieSearch({
    query: {
      ...params,
      limit: PER_PAGE,
    },
  })

  if (!('docs' in response.data)) {
    return { movies: [], totalPages: 0 }
  }

  return {
    movies: response.data.docs.map(mapDocToMovie),
    totalPages: Math.min(MAX_PAGES, response.data.pages),
  }
}

export const getSearchMovies = createCachedFetcher('search', fetchSearchMovies)
