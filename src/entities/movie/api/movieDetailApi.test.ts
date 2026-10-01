import { http, HttpResponse } from 'msw'

import { makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { movieByIdsApi, movieDetailApi } from './movieDetailApi'

const errorBody = (status: number) => ({
  statusCode: status,
  message: 'Forbidden',
  error: 'Forbidden',
})

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

const getDetail = (id: number) =>
  makeStore().dispatch(movieDetailApi.endpoints.getMovieDetail.initiate(id))

describe('getMovieDetail', () => {
  it('маппит ответ в MovieDetail', async () => {
    server.use(
      http.get('*/v1.5/movie/1', () =>
        HttpResponse.json(movieDoc(1, { name: 'Orbit of Silence' })),
      ),
    )

    const result = await getDetail(1)

    expect(result.data).toMatchObject({ id: 1, title: 'Orbit of Silence' })
  })

  it('404 — QueryError со status', async () => {
    server.use(
      http.get('*/v1.5/movie/2', () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Not found', error: 'Not Found' },
          { status: 404 },
        ),
      ),
    )

    const result = await getDetail(2)

    expect(result.error).toMatchObject({ status: 404 })
  })

  it('error-DTO в теле 200 — QueryError со status из тела', async () => {
    server.use(
      http.get('*/v1.5/movie/3', () =>
        HttpResponse.json({ statusCode: 403, message: 'Quota', error: 'x' }),
      ),
    )

    const result = await getDetail(3)

    expect(result.error).toEqual({ status: 403, message: 'Quota' })
  })
})

const image = (overrides: Record<string, unknown> = {}) => ({
  movieId: 1,
  type: 'frame',
  url: 'https://example.com/frame.jpg',
  previewUrl: 'https://example.com/frame-preview.jpg',
  ...overrides,
})

const mockImages = (docs: Record<string, unknown>[]) => {
  let request: Request | undefined
  server.use(
    http.get('*/v1.5/image', ({ request: req }) => {
      request = req
      return HttpResponse.json({
        docs,
        limit: 8,
        next: null,
        prev: null,
        hasNext: false,
        hasPrev: false,
      })
    }),
  )
  return () => request
}

const getImages = (id: number) =>
  makeStore().dispatch(movieDetailApi.endpoints.getMovieImages.initiate(id))

describe('getMovieImages', () => {
  it('уходит на /v1.5/image с movieId, type:[frame,screenshot], limit:8, selectFields', async () => {
    const getRequest = mockImages([image()])

    await getImages(1)

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.getAll('movieId')).toEqual(['1'])
    expect(url.searchParams.getAll('type')).toEqual(['frame', 'screenshot'])
    expect(url.searchParams.get('limit')).toBe('8')
    expect(url.searchParams.getAll('selectFields')).toEqual([
      'url',
      'previewUrl',
    ])
  })

  it('docs маппятся в { url, previewUrl }, запись без url отфильтровывается', async () => {
    mockImages([image({ url: undefined }), image({ previewUrl: undefined })])

    const result = await getImages(1)

    expect(result.data).toEqual([
      { url: 'https://example.com/frame.jpg', previewUrl: undefined },
    ])
  })

  it('error-DTO в теле 200-ответа (нет docs) — пустой список без ошибки', async () => {
    server.use(
      http.get('*/v1.5/image', () => HttpResponse.json(errorBody(403))),
    )

    const result = await getImages(3)

    expect(result.data).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('403 — QueryError со status', async () => {
    server.use(
      http.get('*/v1.5/image', () =>
        HttpResponse.json(errorBody(403), { status: 403 }),
      ),
    )

    const result = await getImages(2)

    expect(result.error).toMatchObject({ status: 403 })
  })
})

const movieError = (status: number) =>
  HttpResponse.json(
    { statusCode: status, message: 'err', error: 'err' },
    { status },
  )

const mockDetail = (id: number, counter?: { count: number }) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () => {
      if (counter) counter.count++
      return HttpResponse.json(movieDoc(id, { name: `Movie ${id}` }))
    }),
  )
}

const getByIds = (ids: number[], store = makeStore()) =>
  store.dispatch(movieByIdsApi.endpoints.getMoviesByIds.initiate(ids))

describe('getMoviesByIds', () => {
  it('отдаёт Movie по каждому id в порядке ids', async () => {
    mockDetail(11)
    mockDetail(12)

    const result = await getByIds([11, 12])

    expect(result.data?.map(movie => movie.id)).toEqual([11, 12])
  })

  it('404 у одного id молча выпадает', async () => {
    mockDetail(21)
    server.use(http.get('*/v1.5/movie/22', () => movieError(404)))

    const result = await getByIds([21, 22])

    expect(result.data?.map(movie => movie.id)).toEqual([21])
    expect(result.error).toBeUndefined()
  })

  it('все id 404 — пустой массив без ошибки', async () => {
    server.use(
      http.get('*/v1.5/movie/31', () => movieError(404)),
      http.get('*/v1.5/movie/32', () => movieError(404)),
    )

    const result = await getByIds([31, 32])

    expect(result.data).toEqual([])
    expect(result.error).toBeUndefined()
  })

  it('полный сбой (не 404) — ошибка', async () => {
    server.use(
      http.get('*/v1.5/movie/41', () => movieError(500)),
      http.get('*/v1.5/movie/42', () => movieError(404)),
    )

    const result = await getByIds([41, 42])

    expect(result.error).toMatchObject({
      message: 'Failed to load movies by ids',
    })
  })

  it('частичный сбой не 404 при наличии фильмов — отдаёт найденные', async () => {
    mockDetail(51)
    server.use(http.get('*/v1.5/movie/52', () => movieError(500)))

    const result = await getByIds([51, 52])

    expect(result.data?.map(movie => movie.id)).toEqual([51])
  })

  it('кеш detail общий: id, уже загруженный как detail, не запрашивается повторно', async () => {
    const counter = { count: 0 }
    mockDetail(61, counter)
    const store = makeStore()

    await store.dispatch(movieDetailApi.endpoints.getMovieDetail.initiate(61))
    await getByIds([61], store)

    expect(counter.count).toBe(1)
  })

  it('пересечение двух списков: общий id запрашивается один раз', async () => {
    const counter = { count: 0 }
    mockDetail(71, counter)
    mockDetail(72)
    mockDetail(73)
    const store = makeStore()

    await getByIds([71, 72], store)
    await getByIds([71, 73], store)

    expect(counter.count).toBe(1)
  })
})
