import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper, makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { movieDetailApi } from '../api/movieDetailApi'
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

describe('useMovieDetail', () => {
  it('оба запроса успешны — data с detail и images', async () => {
    mockMovie(1, { name: 'Orbit of Silence' })
    mockImages([{ url: 'https://example.com/frame.jpg' }])

    const { result } = renderHook(() => useMovieDetail(1), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.detail.title).toBe('Orbit of Silence')
    expect(result.current.data?.images).toHaveLength(1)
  })

  it('картинки падают — images: [], без ошибки', async () => {
    mockMovie(2, { name: 'Quiet Archive' })
    mockImagesError(500)

    const { result } = renderHook(() => useMovieDetail(2), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.images).toEqual([])
    expect(result.current.isError).toBe(false)
  })

  it('фильм 404 — isError, status в error, data нет', async () => {
    mockMovieError(666, 404)
    mockImages([])

    const { result } = renderHook(() => useMovieDetail(666), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 404 })
    expect(result.current.data).toBeUndefined()
  })

  it('refetch после ошибки detail повторяет запрос и отдаёт data', async () => {
    mockMovieError(3, 500)
    mockImages([])

    const { result } = renderHook(() => useMovieDetail(3), {
      wrapper: createStoreWrapper(),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))

    mockMovie(3, { name: 'Recovered' })
    result.current.refetch()

    await waitFor(() =>
      expect(result.current.data?.detail.title).toBe('Recovered'),
    )
  })

  it('смена id не отдаёт данные прошлого фильма', async () => {
    mockMovie(4, { name: 'First' })
    mockMovie(5, { name: 'Second' })
    mockImages([])

    const { result, rerender } = renderHook(({ id }) => useMovieDetail(id), {
      initialProps: { id: 4 },
      wrapper: createStoreWrapper(makeStore()),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    rerender({ id: 5 })

    expect(result.current.data?.detail.title).not.toBe('First')
    await waitFor(() =>
      expect(result.current.data?.detail.title).toBe('Second'),
    )
  })

  it('detail и картинки упали — refetch повторяет и картинки', async () => {
    mockMovieError(7, 500)
    mockImagesError(500)

    const { result } = renderHook(() => useMovieDetail(7), {
      wrapper: createStoreWrapper(),
    })
    await waitFor(() => expect(result.current.isError).toBe(true))

    mockMovie(7, { name: 'Recovered' })
    mockImages([{ url: 'https://example.com/frame.jpg' }])
    act(() => {
      result.current.refetch()
    })

    await waitFor(() => expect(result.current.data?.images).toHaveLength(1))
    expect(result.current.data?.detail.title).toBe('Recovered')
  })

  it('detail упал, картинки ещё грузятся — уже isError', async () => {
    mockMovieError(8, 404)
    server.use(http.get('*/v1.5/image', () => new Promise<never>(() => {})))

    const { result } = renderHook(() => useMovieDetail(8), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 404 })
    expect(result.current.data).toBeUndefined()
  })

  it('фоновый перезапрос картинок не прячет уже показанные data', async () => {
    mockMovie(9)
    mockImages([{ url: 'https://example.com/frame.jpg' }])
    const store = makeStore()

    const { result } = renderHook(() => useMovieDetail(9), {
      wrapper: createStoreWrapper(store),
    })
    await waitFor(() => expect(result.current.data).toBeDefined())

    // перезапрос висит — проверяем состояние «идёт фоновый fetch при готовых data»
    server.use(http.get('*/v1.5/image', () => new Promise<never>(() => {})))
    act(() => {
      void store.dispatch(
        movieDetailApi.endpoints.getMovieImages.initiate(9, {
          forceRefetch: true,
        }),
      )
    })

    await waitFor(() => expect(result.current.isFetching).toBe(true))
    expect(result.current.data?.images).toHaveLength(1)
  })
})
