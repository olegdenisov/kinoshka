import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { getMoviesByIds } from './getMoviesByIds'

const doc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Movie ${id}`,
  alternativeName: `Фильм ${id}`,
  enName: `Movie ${id} EN`,
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
  server.use(
    http.get(`*/v1.5/movie/${id}`, () => HttpResponse.json(doc(id, overrides))),
  )
}

const mockError = (
  id: number,
  status: number,
  body: Record<string, unknown>,
) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () => HttpResponse.json(body, { status })),
  )
}

describe('getMoviesByIds — успешные сценарии', () => {
  it('несколько id — результат Movie[] в порядке входного массива', async () => {
    mockSuccess(201, { name: 'First' })
    mockSuccess(202, { name: 'Second' })
    mockSuccess(203, { name: 'Third' })

    const movies = await getMoviesByIds([203, 201, 202])

    expect(movies.map(movie => movie.id)).toEqual([203, 201, 202])
    expect(movies.map(movie => movie.title)).toEqual([
      'Third',
      'First',
      'Second',
    ])
  })

  it('пустой ids — [] без сетевого запроса', async () => {
    const movies = await getMoviesByIds([])

    expect(movies).toEqual([])
  })
})

describe('getMoviesByIds — edge cases', () => {
  it('один id отвечает 404 — молча выпадает из результата, остальные присутствуют', async () => {
    mockSuccess(301, { name: 'Survives' })
    mockError(302, 404, {
      statusCode: 404,
      message: 'Not found movie with id 302',
      error: 'Not Found',
    })
    mockSuccess(303, { name: 'Also survives' })

    const movies = await getMoviesByIds([301, 302, 303])

    expect(movies.map(movie => movie.id)).toEqual([301, 303])
  })

  it('повторный вызов с тем же массивом id переиспользует закэшированный промис', async () => {
    mockSuccess(401, { name: 'Cached' })

    const first = getMoviesByIds([401])
    const second = getMoviesByIds([401])

    expect(first).toBe(second)
    await first
  })
})
