import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'
import { getSearchMovies } from './getSearchMovies'

const ENDPOINT = '*/v1.4/movie/search'

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
  poster: { previewUrl: 'https://example.com/poster.jpg', url: 'https://example.com/poster-full.jpg' },
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
  hue: 0,
}

const mockSuccess = (docs: Record<string, unknown>[]) => {
  let request: Request | undefined

  server.use(
    http.get(ENDPOINT, ({ request: req }) => {
      request = req
      return HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10 })
    }),
  )

  return () => request
}

const mockForbidden = () => {
  server.use(
    http.get(ENDPOINT, () =>
      HttpResponse.json({ statusCode: 403, message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
    ),
  )
}

describe('getSearchMovies — запрос', () => {
  it('уходит на /v1.4/movie/search с query и page из аргументов', async () => {
    const getRequest = mockSuccess([doc()])

    await getSearchMovies({query: 'matrix', page: 2})

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.get('query')).toBe('matrix')
    expect(url.searchParams.get('page')).toBe('2')
  })

  it('без page — параметр page не отправляется', async () => {
    const getRequest = mockSuccess([doc()])

    await getSearchMovies({query: 'no-page'})

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.has('page')).toBe(false)
  })

  it('403 — промис реджектится', async () => {
    mockForbidden()

    await expect(getSearchMovies({query: 'forbidden'})).rejects.toThrow()
  })
})

describe('getSearchMovies — маппинг SearchMovieDtoV14 → Movie', () => {
  it('полностью заполненный docs-элемент маппится в Movie', async () => {
    mockSuccess([doc()])

    const movies = await getSearchMovies({query: 'full-map'})

    expect(movies).toEqual([expectedMovie])
  })

  it('пустой docs — возвращает []', async () => {
    mockSuccess([])

    const movies = await getSearchMovies({query: 'empty-docs'})

    expect(movies).toEqual([])
  })

  it('ответ без поля docs (неожиданная форма) — возвращает []', async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json({ unexpected: true })))

    const movies = await getSearchMovies({query: 'no-docs'})

    expect(movies).toEqual([])
  })
})

describe('getSearchMovies — fallback названия name ?? alternativeName ?? enName', () => {
  it('name есть — используется name', async () => {
    mockSuccess([doc({ name: 'Primary', alternativeName: 'Alt', enName: 'En' })])

    const [movie] = await getSearchMovies({query: 'title-name'})

    expect(movie.title).toBe('Primary')
  })

  it('name отсутствует — используется alternativeName', async () => {
    mockSuccess([doc({ name: null, alternativeName: 'Alt', enName: 'En' })])

    const [movie] = await getSearchMovies({query: 'title-alt'})

    expect(movie.title).toBe('Alt')
  })

  it('name и alternativeName отсутствуют — используется enName', async () => {
    mockSuccess([doc({ name: null, alternativeName: null, enName: 'En' })])

    const [movie] = await getSearchMovies({query: 'title-en'})

    expect(movie.title).toBe('En')
  })

  it('name, alternativeName и enName отсутствуют — пустая строка', async () => {
    mockSuccess([doc({ name: null, alternativeName: null, enName: null })])

    const [movie] = await getSearchMovies({query: 'title-empty'})

    expect(movie.title).toBe('')
  })
})

describe('getSearchMovies — постер без серверного notNullFields-отсечения', () => {
  // Конвенция из getMovies.ts: берём poster.previewUrl, при отсутствии — пустая строка,
  // плейсхолдер «— poster —» дорисовывает Poster-компонент по пустому movie.poster.
  it('poster.previewUrl отсутствует — пустая строка (плейсхолдер рисует Poster-компонент)', async () => {
    mockSuccess([doc({ poster: { previewUrl: null, url: 'https://example.com/full.jpg' } })])

    const [movie] = await getSearchMovies({query: 'poster-preview-null'})

    expect(movie.poster).toBe('')
  })

  it('poster целиком отсутствует — пустая строка', async () => {
    mockSuccess([doc({ poster: null })])

    const [movie] = await getSearchMovies({query: 'poster-null'})

    expect(movie.poster).toBe('')
  })
})

describe('getSearchMovies — рейтинг и остальные поля без notNullFields-отсечения', () => {
  it('rating.kp отсутствует — используется rating.imdb', async () => {
    mockSuccess([doc({ rating: { kp: null, imdb: 6.5 } })])

    const [movie] = await getSearchMovies({query: 'rating-imdb'})

    expect(movie.rating).toBe(6.5)
  })

  it('rating целиком отсутствует — 0', async () => {
    mockSuccess([doc({ rating: null })])

    const [movie] = await getSearchMovies({query: 'rating-null'})

    expect(movie.rating).toBe(0)
  })

  it('type отсутствует — по умолчанию "movie"', async () => {
    mockSuccess([doc({ type: null })])

    const [movie] = await getSearchMovies({query: 'type-default'})

    expect(movie.type).toBe('movie')
  })

  it('genres отсутствует — пустой массив', async () => {
    mockSuccess([doc({ genres: null })])

    const [movie] = await getSearchMovies({query: 'genres-empty'})

    expect(movie.genre).toEqual([])
  })

  it('movieLength отсутствует — runtime "0"', async () => {
    mockSuccess([doc({ movieLength: null })])

    const [movie] = await getSearchMovies({query: 'runtime-zero'})

    expect(movie.runtime).toBe('0')
  })

  it('year отсутствует — undefined (как в getMovies)', async () => {
    mockSuccess([doc({ year: null })])

    const [movie] = await getSearchMovies({query: 'year-missing'})

    expect(movie.year).toBeUndefined()
  })
})
