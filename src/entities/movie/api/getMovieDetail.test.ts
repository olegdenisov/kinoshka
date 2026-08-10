import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'
import { ApiError } from '@shared/api'
import { getMovieDetail } from './getMovieDetail'

const doc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Movie',
  alternativeName: 'Тестовый фильм',
  enName: 'Test Movie EN',
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  slogan: 'Some tagline',
  description: 'Full synopsis.',
  ...overrides,
})

const mockSuccess = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(http.get(`*/v1.5/movie/${id}`, () => HttpResponse.json(doc(id, overrides))))
}

const mockError = (id: number, status: number, body: Record<string, unknown>) => {
  server.use(http.get(`*/v1.5/movie/${id}`, () => HttpResponse.json(body, { status })))
}

describe('getMovieDetail — success', () => {
  it('запрос уходит на /v1.5/movie/:id, ответ маппится в MovieDetail', async () => {
    mockSuccess(101, { name: 'Orbit of Silence' })

    const detail = await getMovieDetail(101)

    expect(detail.id).toBe(101)
    expect(detail.title).toBe('Orbit of Silence')
    expect(detail.tagline).toBe('Some tagline')
    expect(detail.synopsis).toBe('Full synopsis.')
  })

  it('стабильный промис на один и тот же id', async () => {
    mockSuccess(102)

    const first = getMovieDetail(102)
    const second = getMovieDetail(102)

    expect(first).toBe(second)
    await first
  })
})

describe('getMovieDetail — 404', () => {
  it('фильм не найден — реджект с ApiError.status === 404', async () => {
    mockError(666, 404, {
      statusCode: 404,
      message: 'Not found movie with id 666',
      error: 'Not Found',
    })

    const error = await getMovieDetail(666).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })
})

describe('getMovieDetail — 403 cooldown', () => {
  it('403 — промис реджектится (регресс на createCachedFetcher)', async () => {
    mockError(555, 403, {
      statusCode: 403,
      message: 'Forbidden',
      error: 'Forbidden',
    })

    await expect(getMovieDetail(555)).rejects.toThrow()
  })
})
