import { http, HttpResponse } from 'msw'

import { makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { hashHue } from '../lib/hashHue'
import { catalogApi, moviePageApi, movieListApi } from './catalogApi'
import { MAX_PAGES } from './paginationConfig'

const MOVIE_ENDPOINT = '*/v1.5/movie'
const LIST_ENDPOINT = '*/v1.5/list/:slug'

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

const mockMovies = (docs = [doc()]) => {
  server.use(
    http.get(MOVIE_ENDPOINT, () =>
      HttpResponse.json({
        docs,
        total: docs.length,
        page: 1,
        pages: 1,
        limit: 10,
      }),
    ),
  )
}

const errorBody = (status: number) => ({
  statusCode: status,
  message: 'Forbidden',
  error: 'Forbidden',
})

const getMovies = (
  params: Parameters<typeof movieListApi.endpoints.getMovies.initiate>[0],
) => makeStore().dispatch(movieListApi.endpoints.getMovies.initiate(params))

const listItem = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  positionDiff: 2,
  rating: 8.1,
  votes: 1000,
  movie: {
    id: 1,
    name: 'Test Movie',
    year: 2024,
    movieLength: 120,
    poster: { previewUrl: 'https://example.com/poster.jpg' },
    rating: { kp: 8.1, imdb: 7.9 },
  },
  ...overrides,
})

const mockList = (docs: Record<string, unknown>[]) => {
  server.use(
    http.get(LIST_ENDPOINT, () =>
      HttpResponse.json({
        name: 'Popular',
        slug: 'popular',
        movies: {
          docs,
          limit: 10,
          next: null,
          prev: null,
          hasNext: false,
          hasPrev: false,
        },
      }),
    ),
  )
}

const getPopular = (params: { slug: string; limit: number }) =>
  makeStore().dispatch(movieListApi.endpoints.getPopularMovies.initiate(params))

describe('getMovies', () => {
  it('маппит docs-элемент в Movie', async () => {
    mockMovies()

    const result = await getMovies({ type: ['movie'] })

    expect(result.data).toEqual([
      {
        id: 1,
        title: 'Test Movie',
        year: 2024,
        rating: 8.1,
        type: 'movie',
        genre: ['drama'],
        runtime: '120',
        poster: 'https://example.com/poster.jpg',
        hue: hashHue(1),
      },
    ])
  })

  it('year отсутствует — undefined, а не текущий год', async () => {
    mockMovies([doc({ year: null })])

    const result = await getMovies({ type: ['movie'] })

    expect(result.data?.[0].year).toBeUndefined()
  })

  it('rating.kp равен 0 — используется 0, а не rating.imdb', async () => {
    mockMovies([doc({ rating: { kp: 0, imdb: 6.5 } })])

    const result = await getMovies({ type: ['movie'] })

    expect(result.data?.[0].rating).toBe(0)
  })

  it('sortField/sortType уходят в query как есть', async () => {
    let request: Request | undefined
    server.use(
      http.get(MOVIE_ENDPOINT, ({ request: req }) => {
        request = req
        return HttpResponse.json({ docs: [doc()] })
      }),
    )

    await getMovies({ sortField: ['rating.kp'], sortType: ['-1'] })

    const url = new URL(request!.url)
    expect(url.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url.searchParams.getAll('sortType')).toEqual(['-1'])
  })

  it('error-DTO в теле 200-ответа (нет docs) — пустой список', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () => HttpResponse.json(errorBody(403))),
    )

    const result = await getMovies({ type: ['movie'] })

    expect(result.data).toEqual([])
  })

  it('HTTP-ошибка — QueryError со status', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () =>
        HttpResponse.json(errorBody(403), { status: 403 }),
      ),
    )

    const result = await getMovies({ type: ['movie'] })

    expect(result.error).toMatchObject({ status: 403 })
    expect(result.data).toBeUndefined()
  })
})

describe('getPopularMovies', () => {
  it('маппит movies.docs в PopularMovie[] с position/positionDiff', async () => {
    mockList([listItem()])

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.data).toEqual([
      {
        id: 1,
        title: 'Test Movie',
        year: 2024,
        rating: 8.1,
        type: 'movie',
        genre: [],
        runtime: '120',
        poster: 'https://example.com/poster.jpg',
        hue: hashHue(1),
        position: 1,
        positionDiff: 2,
      },
    ])
  })

  it('positionDiff отсутствует — остаётся undefined', async () => {
    mockList([listItem({ positionDiff: undefined })])

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.data?.[0].positionDiff).toBeUndefined()
  })

  it('пустой movies.docs — []', async () => {
    mockList([])

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.data).toEqual([])
  })

  it('отправляет query.limit ровно тем значением, что передано', async () => {
    let receivedLimit: string | null = null
    server.use(
      http.get(LIST_ENDPOINT, ({ request }) => {
        receivedLimit = new URL(request.url).searchParams.get('limit')
        return HttpResponse.json({
          name: 'Popular',
          slug: 'popular',
          movies: { docs: [], limit: 5 },
        })
      }),
    )

    await getPopular({ slug: 'popular', limit: 5 })

    expect(receivedLimit).toBe('5')
  })

  it.each([404, 403])('HTTP %i — QueryError со status', async status => {
    server.use(
      http.get(LIST_ENDPOINT, () =>
        HttpResponse.json(errorBody(status), { status }),
      ),
    )

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.error).toMatchObject({ status })
  })

  it('error-DTO в теле 200-ответа — QueryError со status из DTO', async () => {
    server.use(
      http.get(LIST_ENDPOINT, () =>
        HttpResponse.json({
          statusCode: 404,
          message: 'Collection not found',
          error: 'Not Found',
        }),
      ),
    )

    const result = await getPopular({ slug: 'popular', limit: 10 })

    expect(result.error).toEqual({
      status: 404,
      message: 'Collection not found',
    })
  })
})

const SEARCH_ENDPOINT = '*/v1.5/movie/search'

const movieNamed = (name: string) => ({
  id: 1,
  title: name,
  year: 2024,
  rating: 8.1,
  type: 'movie',
  genre: ['drama'],
  runtime: '120',
  poster: 'https://example.com/poster.jpg',
  hue: hashHue(1),
})

// Цепочка курсоров: старт (без next) → c2 → c3 → конец списка.
const CHAIN = [
  { cursor: null, name: 'Page1', next: 'c2' },
  { cursor: 'c2', name: 'Page2', next: 'c3' },
  { cursor: 'c3', name: 'Page3', next: null },
]

// total: null — ответ без total (withCount не отработал)
const mockChain = (total: number | null = 25) => {
  const requests: URL[] = []

  server.use(
    http.get(MOVIE_ENDPOINT, ({ request }) => {
      const url = new URL(request.url)
      requests.push(url)
      const cursor = url.searchParams.get('next')
      const step = CHAIN.find(s => s.cursor === cursor)

      if (!step) {
        throw new Error(`unexpected cursor: ${cursor}`)
      }

      return HttpResponse.json({
        docs: [doc({ name: step.name })],
        limit: 12,
        next: step.next,
        hasNext: step.next !== null,
        hasPrev: step.cursor !== null,
        ...(step.cursor === null && total !== null ? { total } : {}),
      })
    }),
  )

  return requests
}

const getPage = (page: number, store = makeStore(), params = {}) =>
  store.dispatch(
    moviePageApi.endpoints.getMoviesPage.initiate({ params, page }),
  )

describe('getCatalogCursorStep', () => {
  it('первый шаг — без next, с withCount:true; следующий — с next, без withCount', async () => {
    const requests = mockChain()
    const store = makeStore()

    const first = await store.dispatch(
      movieListApi.endpoints.getCatalogCursorStep.initiate({ params: {} }),
    )
    await store.dispatch(
      movieListApi.endpoints.getCatalogCursorStep.initiate({
        params: {},
        cursor: 'c2',
      }),
    )

    expect(first.data).toEqual({
      movies: [movieNamed('Page1')],
      next: 'c2',
      total: 25,
    })
    expect(requests[0].searchParams.has('next')).toBe(false)
    expect(requests[0].searchParams.get('withCount')).toBe('true')
    expect(requests[0].searchParams.get('limit')).toBe('12')
    expect(requests[1].searchParams.get('next')).toBe('c2')
    expect(requests[1].searchParams.get('withCount')).toBe('false')
  })

  it('error-DTO в теле 200-ответа — пустой шаг без курсора и total', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () => HttpResponse.json(errorBody(403))),
    )

    const result = await makeStore().dispatch(
      movieListApi.endpoints.getCatalogCursorStep.initiate({ params: {} }),
    )

    expect(result.data).toEqual({ movies: [], next: null, total: null })
  })

  it('error-DTO на первом шаге — страница пустая, totalPages = MAX_PAGES', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () => HttpResponse.json(errorBody(403))),
    )

    const result = await getPage(1)

    expect(result.data).toEqual({ movies: [], totalPages: MAX_PAGES })
  })
})

describe('getMoviesPage', () => {
  it('страница N делает N запросов, результат — доки N-го шага', async () => {
    const requests = mockChain()

    const result = await getPage(3)

    expect(requests).toHaveLength(3)
    expect(result.data).toEqual({
      movies: [movieNamed('Page3')],
      totalPages: 3,
    })
  })

  it('страница N+1 после N — один запрос (шаги из кеша)', async () => {
    const requests = mockChain()
    const store = makeStore()

    await getPage(2, store)
    expect(requests).toHaveLength(2)

    const result = await getPage(3, store)

    expect(requests).toHaveLength(3)
    expect(result.data?.movies).toEqual([movieNamed('Page3')])
  })

  it('уже пройденная страница — без новых запросов', async () => {
    const requests = mockChain()
    const store = makeStore()

    await getPage(3, store)
    const page2 = await getPage(2, store)

    expect(requests).toHaveLength(3)
    expect(page2.data?.movies).toEqual([movieNamed('Page2')])
  })

  it('курсор кончился раньше целевой страницы — пустой хвост, totalPages из total', async () => {
    const requests = mockChain(5)

    const result = await getPage(5)

    expect(result.data).toEqual({ movies: [], totalPages: 1 })
    // цепочка оборвалась на третьем шаге — дальше не ходим
    expect(requests).toHaveLength(3)
  })

  it.each([
    [115, 10],
    [125, 10],
    [15, 2],
  ])('total=%i → totalPages=%i', async (total, totalPages) => {
    mockChain(total)

    const result = await getPage(1)

    expect(result.data?.totalPages).toBe(totalPages)
  })

  it('total недоступен — totalPages = MAX_PAGES', async () => {
    mockChain(null)

    const result = await getPage(1)

    expect(result.data?.totalPages).toBe(10)
  })

  it('ошибка шага — QueryError со status', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () =>
        HttpResponse.json(errorBody(403), { status: 403 }),
      ),
    )

    const result = await getPage(2)

    expect(result.error).toMatchObject({ status: 403 })
  })

  it.each([0, -1])(
    'page=%i — отдаёт первую страницу одним запросом',
    async page => {
      const requests = mockChain()

      const result = await getPage(page)

      expect(requests).toHaveLength(1)
      expect(result.data?.movies).toEqual([movieNamed('Page1')])
    },
  )

  it('ошибка на шаге k>1 — QueryError, дальше по курсору не идёт', async () => {
    const requests: (string | null)[] = []
    server.use(
      http.get(MOVIE_ENDPOINT, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('next')
        requests.push(cursor)
        return cursor === 'c2'
          ? HttpResponse.json(errorBody(500), { status: 500 })
          : HttpResponse.json({ docs: [doc()], next: 'c2', total: 36 })
      }),
    )

    const result = await getPage(3)

    expect(result.error).toMatchObject({ status: 500 })
    expect(requests).toEqual([null, 'c2'])
  })

  it('после ошибки повторный запрос реально идёт в сеть', async () => {
    let attempts = 0
    server.use(
      http.get(MOVIE_ENDPOINT, () => {
        attempts += 1
        return attempts === 1
          ? HttpResponse.json(errorBody(403), { status: 403 })
          : HttpResponse.json({ docs: [doc()], next: null, total: 1 })
      }),
    )
    const store = makeStore()

    const failed = store.dispatch(
      moviePageApi.endpoints.getMoviesPage.initiate({ params: {}, page: 1 }),
    )
    expect((await failed).isError).toBe(true)

    const retried = await failed.refetch()

    expect(retried.data?.movies).toHaveLength(1)
    expect(attempts).toBe(2)
    failed.unsubscribe()
  })
})

const mockSearch = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  const requests: URL[] = []
  server.use(
    http.get(SEARCH_ENDPOINT, ({ request }) => {
      requests.push(new URL(request.url))
      return HttpResponse.json({
        docs,
        total: docs.length,
        page: 1,
        pages: 1,
        limit: 12,
        ...overrides,
      })
    }),
  )
  return requests
}

const getSearch = (query: string, page = 1) =>
  makeStore().dispatch(
    movieListApi.endpoints.getSearchMovies.initiate({ query, page }),
  )

describe('getSearchMovies', () => {
  it('уходит на /v1.5/movie/search с query, page и limit:12', async () => {
    const requests = mockSearch([doc()])

    await getSearch('matrix', 2)

    expect(requests[0].searchParams.get('query')).toBe('matrix')
    expect(requests[0].searchParams.get('page')).toBe('2')
    expect(requests[0].searchParams.get('limit')).toBe('12')
  })

  it('результат — { movies, totalPages }, totalPages = pages из ответа', async () => {
    mockSearch([doc()], { pages: 4 })

    const result = await getSearch('pages-under-cap')

    expect(result.data).toEqual({
      movies: [movieNamed('Test Movie')],
      totalPages: 4,
    })
  })

  it('pages больше demo-потолка — totalPages клампится к 10', async () => {
    mockSearch([doc()], { pages: 37 })

    const result = await getSearch('pages-over-cap')

    expect(result.data?.totalPages).toBe(10)
  })

  it('ответ без docs — { movies: [], totalPages: 0 }', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, () => HttpResponse.json({ unexpected: true })),
    )

    const result = await getSearch('no-docs')

    expect(result.data).toEqual({ movies: [], totalPages: 0 })
  })

  it('HTTP-ошибка — QueryError со status', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, () =>
        HttpResponse.json(errorBody(403), { status: 403 }),
      ),
    )

    const result = await getSearch('forbidden')

    expect(result.error).toMatchObject({ status: 403 })
  })
})

describe('getCatalog', () => {
  it('непустой query — ветка поиска, каталог не запрашивается', async () => {
    const searchRequests = mockSearch([doc({ name: 'Matrix' })], { pages: 3 })
    const catalogRequests = mockChain()

    const result = await makeStore().dispatch(
      catalogApi.endpoints.getCatalog.initiate({ query: 'matrix', page: 1 }),
    )

    expect(result.data).toEqual({
      movies: [movieNamed('Matrix')],
      totalPages: 3,
      query: 'matrix',
    })
    expect(searchRequests).toHaveLength(1)
    expect(catalogRequests).toHaveLength(0)
  })

  it('пустой query — ветка каталога с params, поиск не запрашивается', async () => {
    const searchRequests = mockSearch([doc()])
    const catalogRequests = mockChain()

    const result = await makeStore().dispatch(
      catalogApi.endpoints.getCatalog.initiate({
        query: '',
        params: { type: ['movie'] },
        page: 2,
      }),
    )

    expect(result.data?.movies).toEqual([movieNamed('Page2')])
    expect(result.data?.query).toBe('')
    expect(catalogRequests).toHaveLength(2)
    expect(catalogRequests[0].searchParams.getAll('type')).toEqual(['movie'])
    expect(searchRequests).toHaveLength(0)
  })

  it('делит кеш с getMoviesPage — уже загруженная страница не запрашивается', async () => {
    const requests = mockChain()
    const store = makeStore()

    await getPage(2, store)
    await store.dispatch(
      catalogApi.endpoints.getCatalog.initiate({
        query: '',
        params: {},
        page: 2,
      }),
    )

    expect(requests).toHaveLength(2)
  })

  it('ошибка нижнего endpoint — QueryError со status', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, () =>
        HttpResponse.json(errorBody(403), { status: 403 }),
      ),
    )

    const result = await makeStore().dispatch(
      catalogApi.endpoints.getCatalog.initiate({ query: 'x', page: 1 }),
    )

    expect(result.error).toMatchObject({ status: 403 })
  })
})
