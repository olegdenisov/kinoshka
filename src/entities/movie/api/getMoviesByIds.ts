import type { Movie } from '../model/types'
import { createCachedFetcher } from './createCachedFetcher'
import { getMovieDetail } from './getMovieDetail'

const fetchMoviesByIds = async (ids: number[]): Promise<Movie[]> => {
  const results = await Promise.allSettled(ids.map(id => getMovieDetail(id)))

  return results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
}

export const getMoviesByIds = createCachedFetcher<number[], Movie[]>(
  'favorite-movies',
  fetchMoviesByIds,
)
