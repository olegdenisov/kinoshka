import { apiClient, ApiError } from '@shared/api'

import type { PopularMovie } from '../model/types'
import { createCachedFetcher } from './createCachedFetcher'
import { mapDocToMovie } from './mapDocToMovie'

type RequestParams = {
  slug: string
  limit: number
}

// 24 часа — курируемый список обновляется редко, в отличие от 5-минутных
// TTL остальных фетчеров (см. Technical Details плана 20260825-popular-this-week-rail.md).
const POPULAR_TTL_MS = 24 * 60 * 60 * 1000

const fetchPopularMovies = async (
  params: RequestParams,
): Promise<PopularMovie[]> => {
  const response = await apiClient.getV15ListBySlug({
    path: { slug: params.slug },
    query: { limit: params.limit },
  })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return response.data.movies.docs.map(item => ({
    ...mapDocToMovie(item.movie),
    position: item.position,
    positionDiff: item.positionDiff,
  }))
}

export const getPopularMovies = createCachedFetcher<
  RequestParams,
  PopularMovie[]
>('popularMovies', fetchPopularMovies, { ttlMs: POPULAR_TTL_MS })
