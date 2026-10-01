import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { useNewMovies } from './useNewMovies'

const ENDPOINT = '*/v1.5/movie'

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

const captureQuery = () => {
  const urls: URL[] = []
  server.use(
    http.get(ENDPOINT, ({ request }) => {
      urls.push(new URL(request.url))
      return HttpResponse.json({ docs: [doc()] })
    }),
  )
  return urls
}

describe('useNewMovies', () => {
  it('отдаёт замапленные фильмы', async () => {
    captureQuery()

    const { result } = renderHook(() => useNewMovies(), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data?.[0].title).toBe('Test Movie')
  })

  it('шлёт year текущего года и type из параметров', async () => {
    const urls = captureQuery()

    const { result } = renderHook(() => useNewMovies({ type: ['tv-series'] }), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(urls[0].searchParams.get('year')).toBe(
      new Date().getFullYear().toString(),
    )
    expect(urls[0].searchParams.get('type')).toBe('tv-series')
  })

  it('ошибка — isError со status, refetch повторяет запрос', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return requests === 1
          ? HttpResponse.json(
              { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
              { status: 403 },
            )
          : HttpResponse.json({ docs: [doc({ name: 'Recovered' })] })
      }),
    )

    const { result } = renderHook(() => useNewMovies(), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 403 })

    result.current.refetch()
    await waitFor(() =>
      expect(result.current.data?.[0].title).toBe('Recovered'),
    )
    expect(requests).toBe(2)
  })
})
