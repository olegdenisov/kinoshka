import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { fetchSearchMovies } from './searchMovies'

const ENDPOINT = '*/v1.5/movie/search'

const doc = (id: number) => ({
  id,
  name: `Movie ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
})

const mockSearch = (pages = 3) => {
  const requests: URL[] = []
  server.use(
    http.get(ENDPOINT, ({ request }) => {
      const url = new URL(request.url)
      requests.push(url)
      return HttpResponse.json({
        docs: [doc(Number(url.searchParams.get('page')))],
        total: pages * 12,
        page: 1,
        pages,
        limit: 12,
      })
    }),
  )
  return requests
}

describe('fetchSearchMovies', () => {
  it('шлёт query, page и limit, маппит ответ', async () => {
    const requests = mockSearch(4)

    const result = await fetchSearchMovies({ query: 'matrix', page: 2 })

    expect(requests).toHaveLength(1)
    expect(requests[0].searchParams.get('query')).toBe('matrix')
    expect(requests[0].searchParams.get('page')).toBe('2')
    expect(requests[0].searchParams.get('limit')).toBe('12')
    expect(result.movies.map(movie => movie.id)).toEqual([2])
    expect(result.totalPages).toBe(4)
  })

  it('totalPages ограничен потолком demo-тарифа', async () => {
    mockSearch(37)

    expect(
      (await fetchSearchMovies({ query: 'matrix', page: 1 })).totalPages,
    ).toBe(10)
  })

  it('ответ без docs → пустая выдача', async () => {
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json({ unexpected: true })),
    )

    expect(await fetchSearchMovies({ query: 'odd', page: 1 })).toEqual({
      movies: [],
      totalPages: 0,
    })
  })

  it('повтор тех же параметров не шлёт запрос, другие — шлют', async () => {
    const requests = mockSearch()

    await fetchSearchMovies({ query: 'matrix', page: 1 })
    await fetchSearchMovies({ query: 'matrix', page: 1 })
    await fetchSearchMovies({ query: 'matrix', page: 2 })

    expect(requests).toHaveLength(2)
  })

  it('403 отклоняется и не кэшируется', async () => {
    let attempt = 0
    server.use(
      http.get(ENDPOINT, () => {
        attempt += 1
        return attempt === 1
          ? HttpResponse.json(
              { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
              { status: 403 },
            )
          : HttpResponse.json({ docs: [doc(1)], pages: 1, limit: 12 })
      }),
    )

    await expect(
      fetchSearchMovies({ query: 'matrix', page: 1 }),
    ).rejects.toThrow()
    const result = await fetchSearchMovies({ query: 'matrix', page: 1 })

    expect(result.movies.map(movie => movie.id)).toEqual([1])
    expect(attempt).toBe(2)
  })
})
