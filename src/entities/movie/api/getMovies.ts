import {
  apiClient,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'
import type { Movie } from '../model/types'
import { createCachedFetcher } from './createCachedFetcher'
import { mapDocToMovie } from './mapDocToMovie'

type RequestParams = MovieControllerFindManyByQueryV15Data['query']

const fetchMovies = async (params: RequestParams): Promise<Movie[]> => {
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

export const getMovies = createCachedFetcher('movies', fetchMovies)
