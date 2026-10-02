import {
  apiClient,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'
import { createQueryStore } from '@shared/lib'

import type { Movie } from '../model/types'
import { mapDocToMovie } from './mapDocToMovie'

export type MoviesRequestParams = MovieControllerFindManyByQueryV15Data['query']

export const fetchMovies = async (
  params: MoviesRequestParams,
): Promise<Movie[]> => {
  const response = await apiClient.getV15Movie({
    query: {
      ...params,
      notNullFields: ['poster.url', 'rating.kp', 'rating.imdb'],
      selectFields: [
        'id',
        'name',
        'year',
        'rating',
        'type',
        'genres',
        'movieLength',
        'poster',
      ],
    },
  })

  if (!('docs' in response.data)) {
    // нужно чтобы сузить тип
    return []
  }

  return response.data.docs.map(mapDocToMovie)
}

export const moviesQueryStore = createQueryStore({
  name: 'movies',
  fetcher: fetchMovies,
})
