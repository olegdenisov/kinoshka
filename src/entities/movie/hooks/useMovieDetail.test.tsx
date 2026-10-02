import { ApiError } from '@shared/api'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { getMoviesByIds } from '../api/getMoviesByIds'
import { useMovieDetail } from './useMovieDetail'

const movieDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: 'Test Movie',
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

const mockMovie = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(movieDoc(id, overrides)),
    ),
  )
}

const mockMovieError = (id: number, status: number) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(
        { statusCode: status, message: 'error', error: 'error' },
        { status },
      ),
    ),
  )
}

const mockImages = (docs: Record<string, unknown>[]) => {
  server.use(
    http.get('*/v1.5/image', () =>
      HttpResponse.json({
        docs,
        limit: 8,
        next: null,
        prev: null,
        hasNext: false,
        hasPrev: false,
      }),
    ),
  )
}

const mockImagesError = (status: number) => {
  server.use(
    http.get('*/v1.5/image', () =>
      HttpResponse.json(
        { statusCode: status, message: 'error', error: 'error' },
        { status },
      ),
    ),
  )
}

describe('useMovieDetail — оба запроса успешны', () => {
  it('отдаёт detail и images', async () => {
    mockMovie(1, { name: 'Orbit of Silence' })
    mockImages([
      { movieId: 1, type: 'frame', url: 'https://example.com/frame.jpg' },
    ])

    const { result } = renderHook(() => useMovieDetail(1))

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.detail.title).toBe('Orbit of Silence')
    expect(result.current.data?.images).toHaveLength(1)
  })
})

describe('useMovieDetail — фильм успешен, картинки падают', () => {
  it('images: [] без ошибки', async () => {
    mockMovie(2, { name: 'Quiet Archive' })
    mockImagesError(500)

    const { result } = renderHook(() => useMovieDetail(2))
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.isError).toBe(false)
    expect(result.current.data?.detail.title).toBe('Quiet Archive')
    expect(result.current.data?.images).toEqual([])
  })
})

describe('useMovieDetail — фильм падает (404)', () => {
  it('isError с ApiError.status === 404, данных нет', async () => {
    mockMovieError(666, 404)
    mockImages([])

    const { result } = renderHook(() => useMovieDetail(666))
    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeInstanceOf(ApiError)
    expect((result.current.error as ApiError).status).toBe(404)
    expect(result.current.data).toBeUndefined()
  })
})

describe('useMovieDetail — смена id', () => {
  it('новый id: данные прежнего не показываются, пока грузится новый', async () => {
    mockMovie(10, { name: 'First' })
    mockMovie(11, { name: 'Second' })
    mockImages([])

    const { result, rerender } = renderHook(({ id }) => useMovieDetail(id), {
      initialProps: { id: 10 },
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    rerender({ id: 11 })

    expect(result.current.data).toBeUndefined()
    expect(result.current.isLoading).toBe(true)
    await waitFor(() =>
      expect(result.current.data?.detail.title).toBe('Second'),
    )
  })
})

describe('useMovieDetail — общий кеш detail с getMoviesByIds', () => {
  it('detail, загруженный страницей фильма, не запрашивается повторно списком', async () => {
    let requests = 0
    server.use(
      http.get('*/v1.5/movie/20', () => {
        requests += 1
        return HttpResponse.json(movieDoc(20, { name: 'Shared' }))
      }),
    )
    mockImages([])

    const { result } = renderHook(() => useMovieDetail(20))
    await waitFor(() => expect(result.current.data).toBeDefined())

    const movies = await getMoviesByIds([20])

    expect(movies.map(movie => movie.id)).toEqual([20])
    expect(requests).toBe(1)
  })
})

describe('useMovieDetail — Retry', () => {
  it('refetch после ошибки сразу уходит в сеть (без ожидания кулдауна)', async () => {
    mockMovieError(30, 500)
    mockImages([])

    const { result } = renderHook(() => useMovieDetail(30))
    await waitFor(() => expect(result.current.isError).toBe(true))

    mockMovie(30, { name: 'Recovered' })
    result.current.refetch()

    await waitFor(() =>
      expect(result.current.data?.detail.title).toBe('Recovered'),
    )
    expect(result.current.isError).toBe(false)
  })
})
