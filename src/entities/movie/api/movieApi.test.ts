import { http, HttpResponse } from 'msw'

import { makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { hashHue } from '../lib/hashHue'
import { movieApi } from './movieApi'

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

const mockMovies = (docs = [doc()]) => {
  server.use(
    http.get(MOVIE_ENDPOINT, () =>
      HttpResponse.json({
        docs,
        total: docs.length,
        page: 1,
        pages: 1,
        limit: 10,
      }),
    ),
  )
}

const errorBody = (status: number) => ({
  statusCode: status,
  message: 'Forbidden',
  error: 'Forbidden',
})

const getMovies = (
  params: Parameters<typeof movieApi.endpoints.getMovies.initiate>[0],
) => makeStore().dispatch(movieApi.endpoints.getMovies.initiate(params))

const listItem = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  positionDiff: 2,
  rating: 8.1,
  votes: 1000,
  movie: {
    id: 1,
    name: 'Test Movie',
    year: 2024,
    movieLength: 120,
    poster: { previewUrl: 'https://example.com/poster.jpg' },
    rating: { kp: 8.1, imdb: 7.9 },
  },
  ...overrides,
})

const mockList = (docs: Record<string, unknown>[]) => {
  server.use(
    http.get(LIST_ENDPOINT, () =>
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
      }),
    ),
  )
}

const getPopular = (params: { slug: string; limit: number }) =>
  makeStore().dispatch(movieApi.endpoints.getPopularMovies.initiate(params))

describe('getMovies', () => {
  it('маппит docs-элемент в Movie', async () => {
    mockMovies()

    const result = await getMovies({ type: ['movie'] })

    expect(result.data).toEqual([
      {
        id: 1,
        title: 'Test Movie',
        year: 2024,
        rating: 8.1,
        type: 'movie',
        genre: ['drama'],
        runtime: '120',
        poster: 'https://example.com/poster.jpg',
        hue: hashHue(1),
      },
    ])
  })

  it('year отсутствует — undefined, а не текущий год', async () => {
    mockMovies([doc({ year: null })])

    const result = await getMovies({ type: ['movie'] })

    expect(result.data?.[0].year).toBeUndefined()
  })

  it('rating.kp равен 0 — используется 0, а не rating.imdb', async () => {
    mockMovies([doc({ rating: { kp: 0, imdb: 6.5 } })])

    const result = await getMovies({ type: ['movie'] })

    expect(result.data?.[0].rating).toBe(0)
  })

  it('sortField/sortType уходят в query как есть', async () => {
    let request: Request | undefined
    server.use(
      http.get(MOVIE_ENDPOINT, ({ request: req }) => {
        request = req
        return HttpResponse.json({ docs: [doc()] })
      }),
    )

    await getMovies({ sortField: ['rating.kp'], sortType: ['-1'] })

    const url = new URL(request!.url)
    expect(url.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url.searchParams.getAll('sortType')).toEqual(['-1'])
  })

  it('error-DTO в теле 200-ответа (нет docs) — пустой список', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () => HttpResponse.json(errorBody(403))),
    )

    const result = await getMovies({ type: ['movie'] })

    expect(result.data).toEqual([])
  })

  it('HTTP-ошибка — QueryError со status', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () =>
        HttpResponse.json(errorBody(403), { status: 403 }),
      ),
    )

    const result = await getMovies({ type: ['movie'] })

    expect(result.error).toMatchObject({ status: 403 })
    expect(result.data).toBeUndefined()
  })
})

describe('getPopularMovies', () => {
  it('маппит movies.docs в PopularMovie[] с position/positionDiff', async () => {
    mockList([listItem()])

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.data).toEqual([
      {
        id: 1,
        title: 'Test Movie',
        year: 2024,
        rating: 8.1,
        type: 'movie',
        genre: [],
        runtime: '120',
        poster: 'https://example.com/poster.jpg',
        hue: hashHue(1),
        position: 1,
        positionDiff: 2,
      },
    ])
  })

  it('positionDiff отсутствует — остаётся undefined', async () => {
    mockList([listItem({ positionDiff: undefined })])

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.data?.[0].positionDiff).toBeUndefined()
  })

  it('пустой movies.docs — []', async () => {
    mockList([])

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.data).toEqual([])
  })

  it('отправляет query.limit ровно тем значением, что передано', async () => {
    let receivedLimit: string | null = null
    server.use(
      http.get(LIST_ENDPOINT, ({ request }) => {
        receivedLimit = new URL(request.url).searchParams.get('limit')
        return HttpResponse.json({
          name: 'Popular',
          slug: 'popular',
          movies: { docs: [], limit: 5 },
        })
      }),
    )

    await getPopular({ slug: 'popular', limit: 5 })

    expect(receivedLimit).toBe('5')
  })

  it.each([404, 403])('HTTP %i — QueryError со status', async status => {
    server.use(
      http.get(LIST_ENDPOINT, () =>
        HttpResponse.json(errorBody(status), { status }),
      ),
    )

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.error).toMatchObject({ status })
  })

  it('error-DTO в теле 200-ответа — QueryError со status из DTO', async () => {
    server.use(
      http.get(LIST_ENDPOINT, () =>
        HttpResponse.json({
          statusCode: 404,
          message: 'Collection not found',
          error: 'Not Found',
        }),
      ),
    )

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.error).toEqual({
      status: 404,
      message: 'Collection not found',
    })
  })
})
