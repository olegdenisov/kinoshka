import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { type CatalogParams, loadMoviesPage } from './catalogPage'

const ENDPOINT = '*/v1.5/movie'

const doc = (id: number) => ({
  id,
  name: `Movie ${id}`,
  year: 2024,
  rating: { kp: 8.1, imdb: 7.9 },
  type: 'movie',
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
})

// Курсорная лента: шаг без next → первая страница, next=`c<N>` → страница N+1. `lastPage` —
// страница, после которой курсор обрывается. Записывает курсоры запросов (null — первый шаг).
const mockCursorFeed = ({ lastPage = 10, total = 120 } = {}) => {
  const cursors: (string | null)[] = []
  server.use(
    http.get(ENDPOINT, ({ request }) => {
      const url = new URL(request.url)
      const cursor = url.searchParams.get('next')
      cursors.push(cursor)
      const page = cursor ? Number(cursor.slice(1)) + 1 : 1
      return HttpResponse.json({
        docs: [doc(page)],
        limit: 12,
        next: page < lastPage ? `c${page}` : null,
        total: url.searchParams.get('withCount') === 'true' ? total : undefined,
      })
    }),
  )
  return cursors
}

const PARAMS: CatalogParams = { sortField: ['rating.kp'], sortType: ['-1'] }

describe('loadMoviesPage', () => {
  it('страница 1 — один запрос с withCount, totalPages из total', async () => {
    const cursors = mockCursorFeed({ total: 30 })

    const result = await loadMoviesPage(PARAMS, 1)

    expect(result.movies.map(movie => movie.id)).toEqual([1])
    expect(result.totalPages).toBe(3)
    expect(cursors).toEqual([null])
  })

  it('totalPages ограничен потолком demo-тарифа', async () => {
    mockCursorFeed({ total: 10_000 })

    expect((await loadMoviesPage(PARAMS, 1)).totalPages).toBe(10)
  })

  it('страница N после страницы N−1 шлёт один запрос', async () => {
    const cursors = mockCursorFeed()

    await loadMoviesPage(PARAMS, 2)
    expect(cursors).toEqual([null, 'c1'])

    const result = await loadMoviesPage(PARAMS, 3)

    expect(result.movies.map(movie => movie.id)).toEqual([3])
    expect(cursors).toEqual([null, 'c1', 'c2'])
  })

  it('повтор той же страницы не шлёт запросов', async () => {
    const cursors = mockCursorFeed()

    const first = await loadMoviesPage(PARAMS, 3)
    const second = await loadMoviesPage(PARAMS, 3)

    expect(second).toEqual(first)
    expect(cursors).toHaveLength(3)
  })

  it('другие параметры — отдельный ключ кэша', async () => {
    const cursors = mockCursorFeed()

    await loadMoviesPage(PARAMS, 1)
    await loadMoviesPage({ ...PARAMS, type: ['anime'] }, 1)

    expect(cursors).toEqual([null, null])
  })

  it('обрыв курсора раньше целевой страницы даёт пустую страницу', async () => {
    const cursors = mockCursorFeed({ lastPage: 2, total: 120 })

    const result = await loadMoviesPage(PARAMS, 5)

    expect(result.movies).toEqual([])
    expect(result.totalPages).toBe(10)
    expect(cursors).toEqual([null, 'c1'])
  })

  it('ошибка шага пробрасывается и не кэшируется', async () => {
    let attempt = 0
    server.use(
      http.get(ENDPOINT, () => {
        attempt += 1
        return attempt === 1
          ? HttpResponse.json(
              { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
              { status: 403 },
            )
          : HttpResponse.json({
              docs: [doc(1)],
              limit: 12,
              next: null,
              total: 1,
            })
      }),
    )

    await expect(loadMoviesPage(PARAMS, 1)).rejects.toThrow()
    const result = await loadMoviesPage(PARAMS, 1)

    expect(result.movies.map(movie => movie.id)).toEqual([1])
    expect(attempt).toBe(2)
  })
})
