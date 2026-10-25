import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper, makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { usePopularMovies } from './usePopularMovies'

const ENDPOINT = '*/v1.5/list/:slug'

const successResponse = () =>
  HttpResponse.json({
    name: 'Popular',
    slug: 'popular',
    movies: {
      docs: [
        {
          position: 1,
          positionDiff: 2,
          movie: {
            id: 1,
            name: 'Test Movie',
            year: 2024,
            movieLength: 120,
            poster: { previewUrl: 'https://example.com/poster.jpg' },
            rating: { kp: 8.1 },
          },
        },
      ],
    },
  })

describe('usePopularMovies', () => {
  it('отдаёт замапленные данные с position/positionDiff', async () => {
    server.use(http.get(ENDPOINT, () => successResponse()))

    const { result } = renderHook(() => usePopularMovies(), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(result.current.data?.[0]).toMatchObject({
      title: 'Test Movie',
      position: 1,
      positionDiff: 2,
    })
  })

  it('ошибка — isError, refetch повторяет запрос и отдаёт данные', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return requests === 1
          ? HttpResponse.json(
              { statusCode: 500, message: 'boom', error: 'x' },
              { status: 500 },
            )
          : successResponse()
      }),
    )

    const { result } = renderHook(() => usePopularMovies(), {
      wrapper: createStoreWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    result.current.refetch()
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(requests).toBe(2)
  })

  it('два потребителя в одном сторе (rail и /popular) делят один запрос', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return successResponse()
      }),
    )
    const wrapper = createStoreWrapper(makeStore())

    const first = renderHook(() => usePopularMovies(), { wrapper })
    const second = renderHook(() => usePopularMovies(), { wrapper })

    await waitFor(() => expect(first.result.current.data).toHaveLength(1))
    await waitFor(() => expect(second.result.current.data).toHaveLength(1))
    expect(requests).toBe(1)
  })
})
