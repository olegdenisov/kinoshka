import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { hashHue } from '../lib/hashHue'
import { fetchSearchMovies } from './getSearchMovies'

const ENDPOINT = '*/v1.5/movie/search'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Movie',
  alternativeName: 'Тестовый фильм',
  enName: 'Test Movie EN',
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: {
    previewUrl: 'https://example.com/poster.jpg',
    url: 'https://example.com/poster-full.jpg',
  },
  ...overrides,
})

const expectedMovie = {
  id: 1,
  title: 'Test Movie',
  year: 2024,
  rating: 8.1,
  type: 'movie',
  genre: ['drama'],
  runtime: '120',
  poster: 'https://example.com/poster.jpg',
  hue: hashHue(1),
}

const mockSuccess = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  let request: Request | undefined

  server.use(
    http.get(ENDPOINT, ({ request: req }) => {
      request = req
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

  return () => request
}

const mockForbidden = () => {
  server.use(
    http.get(ENDPOINT, () =>
      HttpResponse.json(
        { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
        { status: 403 },
      ),
    ),
  )
}

describe('fetchSearchMovies — запрос', () => {
  it('уходит на /v1.5/movie/search с query, page и limit:12', async () => {
    const getRequest = mockSuccess([doc()])

    await fetchSearchMovies({ query: 'matrix', page: 2 })

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.get('query')).toBe('matrix')
    expect(url.searchParams.get('page')).toBe('2')
    expect(url.searchParams.get('limit')).toBe('12')
  })

  it('без page — параметр page не отправляется, limit:12 всё равно уходит', async () => {
    const getRequest = mockSuccess([doc()])

    await fetchSearchMovies({ query: 'no-page' })

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.has('page')).toBe(false)
    expect(url.searchParams.get('limit')).toBe('12')
  })

  it('403 — промис реджектится', async () => {
    mockForbidden()

    await expect(fetchSearchMovies({ query: 'forbidden' })).rejects.toThrow()
  })

  it('без кеша: каждый вызов — новый запрос (кеширует стор каталога /search)', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return HttpResponse.json({
          docs: [doc()],
          total: 1,
          page: 1,
          pages: 1,
          limit: 12,
        })
      }),
    )

    await fetchSearchMovies({ query: 'no-cache', page: 1 })
    await fetchSearchMovies({ query: 'no-cache', page: 1 })

    expect(requests).toBe(2)
  })
})

describe('fetchSearchMovies — форма результата { movies, totalPages }', () => {
  it('результат — { movies, totalPages }, totalPages = min(10, pages) из ответа', async () => {
    mockSuccess([doc()], { pages: 4 })

    const result = await fetchSearchMovies({ query: 'pages-under-cap' })

    expect(result).toEqual({ movies: [expectedMovie], totalPages: 4 })
  })

  it('pages из ответа превышает demo-потолок — totalPages клампится к 10', async () => {
    mockSuccess([doc()], { pages: 37 })

    const result = await fetchSearchMovies({ query: 'pages-over-cap' })

    expect(result.totalPages).toBe(10)
  })

  it('пустой docs — movies: [], totalPages из ответа', async () => {
    mockSuccess([], { pages: 0 })

    const result = await fetchSearchMovies({ query: 'empty-docs' })

    expect(result).toEqual({ movies: [], totalPages: 0 })
  })

  it('ответ без поля docs (неожиданная форма) — { movies: [], totalPages: 0 }', async () => {
    server.use(
      http.get(ENDPOINT, () => HttpResponse.json({ unexpected: true })),
    )

    const result = await fetchSearchMovies({ query: 'no-docs' })

    expect(result).toEqual({ movies: [], totalPages: 0 })
  })
})

describe('fetchSearchMovies — маппинг SearchMovieDtoV14 → Movie', () => {
  it('полностью заполненный docs-элемент маппится в Movie', async () => {
    mockSuccess([doc()])

    const { movies } = await fetchSearchMovies({ query: 'full-map' })

    expect(movies).toEqual([expectedMovie])
  })
})

describe('fetchSearchMovies — fallback названия name ?? alternativeName ?? enName', () => {
  it('name есть — используется name', async () => {
    mockSuccess([
      doc({ name: 'Primary', alternativeName: 'Alt', enName: 'En' }),
    ])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'title-name' })

    expect(movie.title).toBe('Primary')
  })

  it('name отсутствует — используется alternativeName', async () => {
    mockSuccess([doc({ name: null, alternativeName: 'Alt', enName: 'En' })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'title-alt' })

    expect(movie.title).toBe('Alt')
  })

  it('name и alternativeName отсутствуют — используется enName', async () => {
    mockSuccess([doc({ name: null, alternativeName: null, enName: 'En' })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'title-en' })

    expect(movie.title).toBe('En')
  })

  it('name, alternativeName и enName отсутствуют — пустая строка', async () => {
    mockSuccess([doc({ name: null, alternativeName: null, enName: null })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'title-empty' })

    expect(movie.title).toBe('')
  })
})

describe('fetchSearchMovies — постер без серверного notNullFields-отсечения', () => {
  // Конвенция из getMovies.ts: берём poster.previewUrl, при отсутствии — пустая строка,
  // плейсхолдер «— poster —» дорисовывает Poster-компонент по пустому movie.poster.
  it('poster.previewUrl отсутствует — пустая строка (плейсхолдер рисует Poster-компонент)', async () => {
    mockSuccess([
      doc({
        poster: { previewUrl: null, url: 'https://example.com/full.jpg' },
      }),
    ])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'poster-preview-null' })

    expect(movie.poster).toBe('')
  })

  it('poster целиком отсутствует — пустая строка', async () => {
    mockSuccess([doc({ poster: null })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'poster-null' })

    expect(movie.poster).toBe('')
  })
})

describe('fetchSearchMovies — рейтинг и остальные поля без notNullFields-отсечения', () => {
  it('rating.kp отсутствует — используется rating.imdb', async () => {
    mockSuccess([doc({ rating: { kp: null, imdb: 6.5 } })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'rating-imdb' })

    expect(movie.rating).toBe(6.5)
  })

  it('rating целиком отсутствует — 0', async () => {
    mockSuccess([doc({ rating: null })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'rating-null' })

    expect(movie.rating).toBe(0)
  })

  it('type отсутствует — по умолчанию "movie"', async () => {
    mockSuccess([doc({ type: null })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'type-default' })

    expect(movie.type).toBe('movie')
  })

  it('genres отсутствует — пустой массив', async () => {
    mockSuccess([doc({ genres: null })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'genres-empty' })

    expect(movie.genre).toEqual([])
  })

  it('movieLength отсутствует — runtime "0"', async () => {
    mockSuccess([doc({ movieLength: null })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'runtime-zero' })

    expect(movie.runtime).toBe('0')
  })

  it('year отсутствует — undefined (как в getMovies)', async () => {
    mockSuccess([doc({ year: null })])

    const {
      movies: [movie],
    } = await fetchSearchMovies({ query: 'year-missing' })

    expect(movie.year).toBeUndefined()
  })
})
