import { ApiError } from '@shared/api'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { hashHue } from '../lib/hashHue'
import {
  fetchPopularMovies,
  newSeries,
  popularMovies,
  topRatedAnime,
  topRatedMovies,
} from './rails'

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

const docsResponse = (docs = [doc()]) =>
  HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10 })

const forbidden = () =>
  HttpResponse.json(
    { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
    { status: 403 },
  )

const listItem = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  positionDiff: 2,
  rating: 8.1,
  votes: 1000,
  movie: doc(),
  ...overrides,
})

const listResponse = (docs: Record<string, unknown>[]) =>
  HttpResponse.json({
    name: 'Popular',
    slug: 'popular',
    movies: {
      docs,
      limit: 10,
      next: null,
      prev: null,
      hasNext: false,
      hasPrev: false,
    },
  })

// Запросы, пришедшие на эндпоинт, как набор query-параметров.
const recordMovieRequests = (
  respond: () => Response = () => docsResponse(),
) => {
  const urls: URL[] = []
  server.use(
    http.get(MOVIE_ENDPOINT, ({ request }) => {
      urls.push(new URL(request.url))
      return respond()
    }),
  )
  return urls
}

describe('ресурсы главной — запрос и маппинг', () => {
  it('topRatedMovies: сортировка по рейтингу без type, фильм маппится в Movie', async () => {
    const urls = recordMovieRequests()
    const unsubscribe = topRatedMovies.subscribe()

    await vi.waitFor(() => expect(topRatedMovies.data()).toHaveLength(1))

    expect(topRatedMovies.data()[0]).toEqual({
      id: 1,
      title: 'Test Movie',
      year: 2024,
      rating: 8.1,
      type: 'movie',
      genre: ['drama'],
      runtime: '120',
      poster: 'https://example.com/poster.jpg',
      hue: hashHue(1),
    })
    expect(urls).toHaveLength(1)
    expect(urls[0].searchParams.get('sortField')).toBe('rating.kp')
    expect(urls[0].searchParams.get('rating.kp')).toBe('7-10')
    expect(urls[0].searchParams.get('sortType')).toBe('-1')
    expect(urls[0].searchParams.has('type')).toBe(false)
    unsubscribe()
  })

  it('topRatedAnime: type=anime', async () => {
    const urls = recordMovieRequests()
    const unsubscribe = topRatedAnime.subscribe()

    await vi.waitFor(() => expect(topRatedAnime.data()).toHaveLength(1))

    expect(urls[0].searchParams.get('type')).toBe('anime')
    expect(urls[0].searchParams.get('rating.kp')).toBe('7-10')
    unsubscribe()
  })

  it('newSeries: type=tv-series и текущий год', async () => {
    const urls = recordMovieRequests()
    const unsubscribe = newSeries.subscribe()

    await vi.waitFor(() => expect(newSeries.data()).toHaveLength(1))

    expect(urls[0].searchParams.get('type')).toBe('tv-series')
    expect(urls[0].searchParams.get('year')).toBe(
      new Date().getFullYear().toString(),
    )
    unsubscribe()
  })

  it('popularMovies: slug и limit, position/positionDiff попадают в фильм', async () => {
    let url: URL | undefined
    server.use(
      http.get(LIST_ENDPOINT, ({ request }) => {
        url = new URL(request.url)
        return listResponse([listItem()])
      }),
    )
    const unsubscribe = popularMovies.subscribe()

    await vi.waitFor(() => expect(popularMovies.data()).toHaveLength(1))

    expect(url?.pathname.endsWith('/popular')).toBe(true)
    expect(url?.searchParams.get('limit')).toBe('10')
    expect(popularMovies.data()[0]).toMatchObject({
      title: 'Test Movie',
      position: 1,
      positionDiff: 2,
    })
    unsubscribe()
  })

  it('ответ без docs даёт пустой список', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () =>
        HttpResponse.json({ statusCode: 200, message: 'x', error: 'x' }),
      ),
    )
    const unsubscribe = topRatedMovies.subscribe()

    await vi.waitFor(() =>
      expect(topRatedMovies.status().isFulfilled).toBe(true),
    )

    expect(topRatedMovies.data()).toEqual([])
    unsubscribe()
  })
})

describe('ресурсы главной — ошибки и общий запрос', () => {
  it('403 на списке → error() с ApiError, без повторного запроса после подписки', async () => {
    const urls = recordMovieRequests(forbidden)
    const unsubscribe = topRatedMovies.subscribe()

    await vi.waitFor(() => expect(topRatedMovies.error()).toBeInstanceOf(Error))

    expect(urls).toHaveLength(1)
    unsubscribe()
  })

  it('403 на popular → error() с ApiError(403)', async () => {
    server.use(http.get(LIST_ENDPOINT, forbidden))
    const unsubscribe = popularMovies.subscribe()

    await vi.waitFor(() =>
      expect(popularMovies.error()).toBeInstanceOf(ApiError),
    )

    expect((popularMovies.error() as ApiError).status).toBe(403)
    unsubscribe()
  })

  it('retry() после ошибки шлёт новый запрос и отдаёт данные', async () => {
    let requests = 0
    server.use(
      http.get(MOVIE_ENDPOINT, () => {
        requests += 1
        return requests === 1 ? forbidden() : docsResponse([doc({ id: 5 })])
      }),
    )
    const unsubscribe = topRatedMovies.subscribe()
    await vi.waitFor(() => expect(topRatedMovies.error()).toBeDefined())

    topRatedMovies.retry()

    await vi.waitFor(() => expect(topRatedMovies.data()[0]?.id).toBe(5))
    expect(requests).toBe(2)
    unsubscribe()
  })

  it('два ресурса с одинаковыми параметрами делят запрос, разные параметры — нет', async () => {
    const urls = recordMovieRequests()
    const unsubscribeA = topRatedAnime.subscribe()
    const unsubscribeB = topRatedMovies.subscribe()

    await vi.waitFor(() => expect(topRatedAnime.data()).toHaveLength(1))
    await vi.waitFor(() => expect(topRatedMovies.data()).toHaveLength(1))
    expect(urls).toHaveLength(2)

    // повторный вызов тех же параметров — из кэша action, запроса нет
    unsubscribeA()
    unsubscribeB()
    const again = topRatedAnime.subscribe()
    await vi.waitFor(() => expect(topRatedAnime.data()).toHaveLength(1))
    expect(urls).toHaveLength(2)
    again()
  })

  it('fetchPopularMovies с теми же параметрами не шлёт второй запрос', async () => {
    let requests = 0
    server.use(
      http.get(LIST_ENDPOINT, () => {
        requests += 1
        return listResponse([listItem()])
      }),
    )

    await Promise.all([
      fetchPopularMovies({ slug: 'popular', limit: 10 }),
      fetchPopularMovies({ slug: 'popular', limit: 10 }),
    ])
    await fetchPopularMovies({ slug: 'popular', limit: 10 })

    expect(requests).toBe(1)
  })
})
