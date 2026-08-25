import { ApiError } from '@shared/api'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { hashHue } from '../lib/hashHue'
import { getPopularMovies } from './getPopularMovies'

const ENDPOINT = '*/v1.5/list/:slug'

const movieDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Movie',
  enName: 'Test Movie EN',
  alternativeName: 'Тестовый фильм',
  year: 2024,
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  rating: { kp: 8.1, imdb: 7.9 },
  ...overrides,
})

const listItem = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  positionDiff: 2,
  rating: 8.1,
  votes: 1000,
  movie: movieDoc(),
  ...overrides,
})

const mockSuccess = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  server.use(
    http.get(ENDPOINT, () =>
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
        ...overrides,
      }),
    ),
  )
}

const mockError = (status: number, body: Record<string, unknown>) => {
  server.use(http.get(ENDPOINT, () => HttpResponse.json(body, { status })))
}

describe('getPopularMovies — success', () => {
  it('мапит movies.docs в PopularMovie[] с position/positionDiff', async () => {
    mockSuccess([listItem()])

    const result = await getPopularMovies({ slug: 'popular', limit: 10 })

    expect(result).toEqual([
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

  it('элемент без type/genres в исходном DTO — дефолты mapDocToMovie (type: "movie", genre: [])', async () => {
    mockSuccess([listItem({ movie: movieDoc() })])

    const [movie] = await getPopularMovies({ slug: 'popular', limit: 10 })

    expect(movie.type).toBe('movie')
    expect(movie.genre).toEqual([])
  })

  it('positionDiff отсутствует — остаётся undefined', async () => {
    mockSuccess([listItem({ positionDiff: undefined })])

    const [movie] = await getPopularMovies({
      slug: 'popular-nodiff',
      limit: 10,
    })

    expect(movie.positionDiff).toBeUndefined()
  })

  it('пустой movies.docs — возвращает []', async () => {
    mockSuccess([])

    const result = await getPopularMovies({ slug: 'popular-empty', limit: 10 })

    expect(result).toEqual([])
  })
})

describe('getPopularMovies — ошибки', () => {
  it('404 — бросает ApiError со status 404', async () => {
    mockError(404, {
      statusCode: 404,
      message: 'Collection not found',
      error: 'Not Found',
    })

    const error = await getPopularMovies({
      slug: 'popular-404',
      limit: 10,
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })

  it('403 — бросает ApiError со status 403', async () => {
    mockError(403, {
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden',
    })

    const error = await getPopularMovies({
      slug: 'popular-403',
      limit: 10,
    }).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(403)
  })
})
