import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { movieDetailStore } from '../api/getMovieDetail'
import { useMoviesByIds } from './useMoviesByIds'

const doc = (id: number) => ({
  id,
  name: `Movie ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
})

const notFound = () =>
  HttpResponse.json(
    { statusCode: 404, message: 'nf', error: 'Not Found' },
    { status: 404 },
  )

// Возвращает счётчик сетевых запросов по id
const mockMovies = (handlers: Record<number, () => Response>) => {
  const calls: Record<number, number> = {}
  Object.entries(handlers).forEach(([rawId, handler]) => {
    const id = Number(rawId)
    calls[id] = 0
    server.use(
      http.get(`*/v1.5/movie/${id}`, () => {
        calls[id]++
        return handler()
      }),
    )
  })

  return calls
}

describe('useMoviesByIds', () => {
  it('пустой список → data: [] без запроса и без загрузки', () => {
    const { result } = renderHook(() => useMoviesByIds([]))

    expect(result.current.data).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('делит кеш с детальной страницей: второго запроса за тем же id нет', async () => {
    const calls = mockMovies({ 11: () => HttpResponse.json(doc(11)) })

    await act(async () => {
      await movieDetailStore.fetch(11)
    })
    const { result } = renderHook(() => useMoviesByIds([11]))

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(calls[11]).toBe(1)
  })

  it('404-id молча выпадает из результата', async () => {
    mockMovies({
      21: () => HttpResponse.json(doc(21)),
      22: notFound,
    })
    const { result } = renderHook(() => useMoviesByIds([21, 22]))

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data?.map(movie => movie.id)).toEqual([21])
  })

  it('все 5xx → isError, refetch перезапрашивает', async () => {
    let healthy = false
    const calls = mockMovies({
      31: () =>
        healthy
          ? HttpResponse.json(doc(31))
          : HttpResponse.json(
              { statusCode: 500, message: 'boom', error: 'err' },
              { status: 500 },
            ),
    })
    const { result } = renderHook(() => useMoviesByIds([31]))

    await waitFor(() => expect(result.current.isError).toBe(true))

    healthy = true
    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.isError).toBe(false)
    expect(calls[31]).toBe(2)
  })

  it('удаление id: удалённая карточка исчезает сразу, без скелетона', async () => {
    mockMovies({
      41: () => HttpResponse.json(doc(41)),
      42: () => HttpResponse.json(doc(42)),
    })
    const { result, rerender } = renderHook(({ ids }) => useMoviesByIds(ids), {
      initialProps: { ids: [41, 42] },
    })

    await waitFor(() => expect(result.current.data).toHaveLength(2))

    rerender({ ids: [42] })

    expect(result.current.data?.map(movie => movie.id)).toEqual([42])
    expect(result.current.isLoading).toBe(false)
  })
})
