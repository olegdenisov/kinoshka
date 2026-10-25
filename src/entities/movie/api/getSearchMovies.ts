import { apiClient } from '@shared/api'

import type { Movie } from '../model/types'
import { mapDocToMovie } from './mapDocToMovie'
import { PER_PAGE, MAX_PAGES } from './paginationConfig'

type SearchMoviesParams = {
  query: string
  page?: number
}

export type SearchMoviesResult = {
  movies: Movie[]
  totalPages: number
}

// Чистая функция без своего стора: единственный потребитель — стор каталога страницы /search,
// собственный стор здесь дал бы двойной кеш одного и того же ответа
export const fetchSearchMovies = async (
  params: SearchMoviesParams,
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
