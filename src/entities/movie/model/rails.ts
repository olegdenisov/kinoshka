import { action, computed, withAsync, withAsyncData, wrap } from '@reatom/core'
import {
  apiClient,
  ApiError,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'
import { withQueryCache } from '@shared/lib'

import { mapDocToMovie } from '../api/mapDocToMovie'
import type { Movie, PopularMovie } from './types'

type MoviesParams = NonNullable<MovieControllerFindManyByQueryV15Data['query']>

type PopularParams = {
  slug: string
  limit: number
}

// 24 часа — курируемый список обновляется редко, в отличие от 5-минутного TTL остальных запросов.
const POPULAR_STALE_MS = 24 * 60 * 60 * 1000

// Тело без wrap вокруг запроса и без чтения атомов после await: с ignoreAbort один промис делят
// все вызывающие, отмена первого не должна ронять запрос остальным.
const fetchMovies = action(async (params: MoviesParams): Promise<Movie[]> => {
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
}, 'movie.fetchList').extend(
  withAsync(),
  withQueryCache({ length: 20, ignoreAbort: true }),
)

export const fetchPopularMovies = action(
  async (params: PopularParams): Promise<PopularMovie[]> => {
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
  },
  'movie.fetchPopular',
).extend(
  withAsync(),
  withQueryCache({
    length: 5,
    staleTime: POPULAR_STALE_MS,
    ignoreAbort: true,
  }),
)

const POPULAR_PARAMS: PopularParams = { slug: 'popular', limit: 10 }

const topRatedParams = (type?: MoviesParams['type']): MoviesParams => ({
  sortField: ['rating.kp'],
  'rating.kp': ['7-10'],
  sortType: ['-1'],
  type,
})

export const topRatedMovies = computed(
  async () => await wrap(fetchMovies(topRatedParams())),
  'movie.topRated',
).extend(withAsyncData({ initState: [], status: true }))

export const topRatedAnime = computed(
  async () => await wrap(fetchMovies(topRatedParams(['anime']))),
  'movie.topRatedAnime',
).extend(withAsyncData({ initState: [], status: true }))

export const newSeries = computed(
  async () =>
    await wrap(
      fetchMovies({
        type: ['tv-series'],
        year: [new Date().getFullYear().toString()],
      }),
    ),
  'movie.newSeries',
).extend(withAsyncData({ initState: [], status: true }))

export const popularMovies = computed(
  async () => await wrap(fetchPopularMovies(POPULAR_PARAMS)),
  'movie.popular',
).extend(withAsyncData({ initState: [], status: true }))
