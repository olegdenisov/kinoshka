import type { Movie } from '@entities/movie'
import { AsyncBoundary } from '@shared/ui'
import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ComponentType } from 'react'

import { server } from '../../../test/setup'
import type { useRecommendedMovies as UseRecommendedMovies } from './useRecommendedMovies'

const FAVORITES_KEY = 'kinoshka:favorites'
const MOVIE_ENDPOINT = (id: number) => `*/v1.5/movie/${id}`
const CATALOG_ENDPOINT = '*/v1.5/movie'

// getMoviesByIds (favorites) и getMoviesPage (каталог) оба кешируют промисы в
// module-scope Map — свежий модуль на каждый тест, чтобы favorites/params с одинаковым
// набором id не залипали между тестами этого файла (см. AGENTS.md, "Изоляция pageCache",
// и Testing Strategy плана — та же техника, что useMovieCatalog.test.tsx/getMoviesPage.test.ts).
const importModule = async () => {
  vi.resetModules()
  const mod = await import('./useRecommendedMovies')
  return mod.useRecommendedMovies
}

const importModules = async () => {
  vi.resetModules()
  const [
    { useRecommendedMovies, invalidateRecommendations },
    entitiesMovie,
    featuresRecommendations,
  ] = await Promise.all([
    import('./useRecommendedMovies'),
    import('@entities/movie'),
    import('@features/recommendations'),
  ])
  return {
    useRecommendedMovies,
    invalidateRecommendations,
    getMoviesPage: entitiesMovie.getMoviesPage,
    computeRecommendationQuery:
      featuresRecommendations.computeRecommendationQuery,
  }
}

const favoriteDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Favorite ${id}`,
  alternativeName: `Избранный ${id}`,
  enName: `Favorite ${id} EN`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'драма' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  slogan: 'tagline',
  description: 'synopsis',
  ...overrides,
})

const catalogDoc = (id: number, name: string) => ({
  id,
  name,
  year: 2023,
  type: 'movie',
  rating: { kp: 7.2, imdb: 7.0 },
  genres: [{ name: 'драма' }],
  movieLength: 100,
  poster: { previewUrl: 'https://example.com/catalog.jpg' },
})

const mockFavorite = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(MOVIE_ENDPOINT(id), () =>
      HttpResponse.json(favoriteDoc(id, overrides)),
    ),
  )
}

const mockFavoriteNotFound = (id: number) => {
  server.use(
    http.get(MOVIE_ENDPOINT(id), () =>
      HttpResponse.json(
        {
          statusCode: 404,
          message: `Not found movie with id ${id}`,
          error: 'Not Found',
        },
        { status: 404 },
      ),
    ),
  )
}

const mockCatalog = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  let request: Request | undefined
  let requests = 0
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request: req }) => {
      request = req
      requests += 1
      return HttpResponse.json({
        docs,
        limit: 12,
        next: null,
        hasNext: false,
        hasPrev: false,
        total: docs.length,
        ...overrides,
      })
    }),
  )
  return { getRequest: () => request, getRequests: () => requests }
}

const Probe: ComponentType<{
  useRecommendedMovies: typeof UseRecommendedMovies
}> = ({ useRecommendedMovies }) => {
  const movies = useRecommendedMovies()

  if (movies === null) {
    return <div data-testid='result'>null</div>
  }

  return (
    <ul data-testid='result'>
      {movies.map(movie => (
        <li key={movie.id}>{movie.title}</li>
      ))}
    </ul>
  )
}

// React 19's use() suspends synchronously — testing-library's render() outside act()
// leaves the pending suspended work unflushed (см. useMovieCatalog.test.tsx за тем же
// приёмом с await act(async ...)).
const renderProbe = async (
  useRecommendedMovies: typeof UseRecommendedMovies,
) => {
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <AsyncBoundary>
        <Probe useRecommendedMovies={useRecommendedMovies} />
      </AsyncBoundary>,
    )
  })
  return result!
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('useRecommendedMovies — непустые favorites с жанрами/рейтингом', () => {
  it('возвращает список фильмов; исходящий запрос реально содержит id/genres.name/rating.kp правила', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([601, 602]))
    mockFavorite(601, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(602, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })
    const { getRequest } = mockCatalog([catalogDoc(701, 'Recommended Movie')])

    const useRecommendedMovies = await importModule()
    await renderProbe(useRecommendedMovies)

    expect(screen.getByTestId('result')).toHaveTextContent('Recommended Movie')

    const url = new URL(getRequest()!.url)
    // exclude favoriteIds — синтаксис `!<id>` (подтверждён types.gen.ts)
    expect(url.searchParams.getAll('id')).toEqual(['!601', '!602'])
    // топ-жанры избранного, по порядку первого появления (триллер раньше драмы)
    expect(url.searchParams.getAll('genres.name')).toEqual(['триллер', 'драма'])
    // avg(8.0, 6.0) − 1 = 6.0
    expect(url.searchParams.getAll('rating.kp')).toEqual(['6.0-10'])
    expect(url.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url.searchParams.getAll('sortType')).toEqual(['-1'])
  })
})

describe('useRecommendedMovies — все favorite id 404-нулись', () => {
  it('getMoviesByIds резолвится в [] → хук возвращает null, без обращения к каталожному эндпоинту', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([801, 802]))
    mockFavoriteNotFound(801)
    mockFavoriteNotFound(802)
    let catalogRequests = 0
    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        catalogRequests += 1
        return HttpResponse.json({
          docs: [],
          limit: 12,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 0,
        })
      }),
    )

    const useRecommendedMovies = await importModule()
    await renderProbe(useRecommendedMovies)

    expect(screen.getByTestId('result')).toHaveTextContent('null')
    expect(catalogRequests).toBe(0)
  })
})

describe('invalidateRecommendations — Retry реально бьёт в сеть', () => {
  it('после успешного рендера хука инвалидатор сбрасывает pageCache для последнего query — повторный getMoviesPage идёт в сеть заново', async () => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([901]))
    mockFavorite(901, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    const { getRequests } = mockCatalog([catalogDoc(1001, 'First Result')])

    const {
      useRecommendedMovies,
      invalidateRecommendations,
      getMoviesPage,
      computeRecommendationQuery,
    } = await importModules()

    await renderProbe(useRecommendedMovies)
    expect(getRequests()).toBe(1)

    invalidateRecommendations([901])

    const { getRequests: getRequests2 } = mockCatalog([
      catalogDoc(1002, 'Recovered Result'),
    ])

    // Тот же query, что вычислил хук внутри себя для favorites=[901] (пересчитано той же
    // чистой функцией из той же версии модуля, что использует хук — а не руками
    // продублированные литералы, которые могли бы разойтись с реальной формулой). Если бы
    // invalidateRecommendations бил не по тому кэш-ключу, этот вызов вернул бы старый
    // закэшированный промис из pageCache вместо нового сетевого запроса.
    const favoriteMovie: Movie = {
      id: 901,
      title: 'Favorite 901',
      rating: 8.0,
      type: 'movie',
      genre: ['триллер'],
      runtime: '120',
      hue: 0,
    }
    const query = computeRecommendationQuery([favoriteMovie])!

    const result = await getMoviesPage(query, 1)

    expect(result.movies[0]?.title).toBe('Recovered Result')
    expect(getRequests2()).toBe(1)
  })
})
