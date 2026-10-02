import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { useNewMovies } from './useNewMovies'
import { usePopularMovies } from './usePopularMovies'
import { useTopRatedMovies } from './useTopRatedMovies'

// Механика кеша — в createQueryStore.test.ts. Здесь: хуки отдают QueryResult, а параметры
// запроса соответствуют своим рейлам.
const MOVIE_ENDPOINT = '*/v1.5/movie'
const LIST_ENDPOINT = '*/v1.5/list/:slug'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Movie',
  year: 2024,
  rating: { kp: 8.1, imdb: 7.9 },
  type: 'movie',
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  ...overrides,
})

const capture = () => {
  const urls: URL[] = []
  server.use(
    http.get(MOVIE_ENDPOINT, ({ request }) => {
      urls.push(new URL(request.url))
      return HttpResponse.json({
        docs: [doc()],
        total: 1,
        page: 1,
        pages: 1,
        limit: 10,
      })
    }),
  )
  return urls
}

describe('useTopRatedMovies', () => {
  it('грузит с сортировкой по рейтингу и type', async () => {
    const urls = capture()

    const { result } = renderHook(() => useTopRatedMovies({ type: ['anime'] }))

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(urls[0].searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(urls[0].searchParams.getAll('type')).toEqual(['anime'])
  })

  it('ошибка → isError, refetch реально перезапрашивает', async () => {
    let requests = 0
    server.use(
      http.get(MOVIE_ENDPOINT, () => {
        requests += 1
        if (requests === 1) {
          return HttpResponse.json(
            { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
            { status: 403 },
          )
        }
        return HttpResponse.json({
          docs: [doc()],
          total: 1,
          page: 1,
          pages: 1,
          limit: 10,
        })
      }),
    )

    const { result } = renderHook(() => useTopRatedMovies())
    await waitFor(() => expect(result.current.isError).toBe(true))

    result.current.refetch()

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(requests).toBe(2)
    expect(result.current.isError).toBe(false)
  })
})

describe('useNewMovies', () => {
  it('грузит с фильтром по текущему году и type', async () => {
    const urls = capture()

    const { result } = renderHook(() => useNewMovies({ type: ['tv-series'] }))

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(urls[0].searchParams.getAll('year')).toEqual([
      new Date().getFullYear().toString(),
    ])
    expect(urls[0].searchParams.getAll('type')).toEqual(['tv-series'])
  })
})

describe('usePopularMovies', () => {
  it('отдаёт PopularMovie с position/positionDiff', async () => {
    server.use(
      http.get(LIST_ENDPOINT, () =>
        HttpResponse.json({
          name: 'Popular',
          slug: 'popular',
          movies: {
            docs: [
              {
                position: 3,
                positionDiff: 1,
                rating: 8,
                votes: 10,
                movie: doc(),
              },
            ],
            limit: 10,
            next: null,
            prev: null,
            hasNext: false,
            hasPrev: false,
          },
        }),
      ),
    )

    const { result } = renderHook(() => usePopularMovies())

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data?.[0]).toMatchObject({
      position: 3,
      positionDiff: 1,
    })
  })
})
