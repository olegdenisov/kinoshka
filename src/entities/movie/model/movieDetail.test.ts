import { ApiError } from '@shared/api'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { fetchMovieDetail } from './movieDetail'

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

// Счётчик запросов по id — проверка «запрос не ушёл», а не только «результат тот же».
const mockMovie = (id: number, overrides: Record<string, unknown> = {}) => {
  const requests = vi.fn()
  server.use(
    http.get(`*/v1.5/movie/${id}`, () => {
      requests()
      return HttpResponse.json(doc(id, overrides))
    }),
  )
  return requests
}

const mockError = (id: number, status: number) => {
  const requests = vi.fn()
  server.use(
    http.get(`*/v1.5/movie/${id}`, () => {
      requests()
      return HttpResponse.json(
        { statusCode: status, message: `Error ${status}`, error: 'Error' },
        { status },
      )
    }),
  )
  return requests
}

describe('fetchMovieDetail', () => {
  it('ответ маппится в MovieDetail', async () => {
    mockMovie(101, { name: 'Orbit of Silence' })

    const detail = await fetchMovieDetail(101)

    expect(detail.id).toBe(101)
    expect(detail.title).toBe('Orbit of Silence')
    expect(detail.tagline).toBe('Some tagline')
  })

  it('повторный вызов с тем же id не шлёт запрос', async () => {
    const requests = mockMovie(102)

    await fetchMovieDetail(102)
    await fetchMovieDetail(102)

    expect(requests).toHaveBeenCalledTimes(1)
  })

  it('параллельные вызовы делят один запрос', async () => {
    const requests = mockMovie(103)

    const [a, b] = await Promise.all([
      fetchMovieDetail(103),
      fetchMovieDetail(103),
    ])

    expect(a).toEqual(b)
    expect(requests).toHaveBeenCalledTimes(1)
  })

  it('404 — ApiError со статусом 404', async () => {
    mockError(666, 404)

    const error = await fetchMovieDetail(666).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(404)
  })

  it('ошибка не кэшируется — следующий вызов шлёт новый запрос', async () => {
    const failing = mockError(555, 403)

    await expect(fetchMovieDetail(555)).rejects.toThrow()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(failing).toHaveBeenCalledTimes(1)

    const succeeding = mockMovie(555)
    expect((await fetchMovieDetail(555)).id).toBe(555)
    expect(succeeding).toHaveBeenCalledTimes(1)
  })
})
