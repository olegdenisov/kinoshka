import { action, withAsync } from '@reatom/core'
import { apiClient } from '@shared/api'
import { withQueryCache } from '@shared/lib'

import { mapDocToMovie } from '../api/mapDocToMovie'
import { MAX_PAGES, PER_PAGE } from '../api/paginationConfig'
import type { Movie } from './types'

type SearchMoviesParams = {
  query: string
  page: number
}

export type SearchMoviesResult = {
  movies: Movie[]
  totalPages: number
}

// Тело без wrap вокруг запроса: с ignoreAbort один промис делят все вызывающие, отмена первого
// не должна ронять запрос остальным. ignoreAbort нужен и здесь: параметры приходят из URL, и
// вызовы из разных кадров иначе не делят кэш (см. withQueryCache).
export const fetchSearchMovies = action(
  async ({ query, page }: SearchMoviesParams): Promise<SearchMoviesResult> => {
    const response = await apiClient.getV15MovieSearch({
      query: { query, page, limit: PER_PAGE },
    })

    if (!('docs' in response.data)) {
      // нужно чтобы сузить тип
      return { movies: [], totalPages: 0 }
    }

    return {
      movies: response.data.docs.map(mapDocToMovie),
      totalPages: Math.min(MAX_PAGES, response.data.pages),
    }
  },
  'movie.fetchSearch',
).extend(withAsync(), withQueryCache({ length: 20, ignoreAbort: true }))
