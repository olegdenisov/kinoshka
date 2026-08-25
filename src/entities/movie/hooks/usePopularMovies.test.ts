import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createElement, Suspense } from 'react'

import { server } from '../../../test/setup'

// Механика кэша (TTL/cooldown/sessionStorage) полностью покрыта createCachedFetcher.test.ts
// и getPopularMovies.test.ts. Здесь — то, что usePopularMovies() отдаёт замапленные данные
// (включая position/positionDiff) через Suspense, и что invalidatePopularMovies бьёт РОВНО
// по тому же кэш-ключу ({ slug: 'popular', limit: 10 }), что использует сам хук.
// createElement вместо JSX — файл остаётся .test.ts (по конвенции соседних hooks/*.test.ts),
// без переключения на .tsx только ради этого пробника.
const ENDPOINT = '*/v1.5/list/:slug'

const movieDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Movie',
  enName: 'Test Movie EN',
  alternativeName: 'Тестовый фильм',
  year: 2024,
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  rating: { kp: 8.1, imdb: 7.9 },
  ...overrides,
})

const listItem = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  positionDiff: 2,
  rating: 8.1,
  votes: 1000,
  movie: movieDoc(),
  ...overrides,
})

const successResponse = (docs: Record<string, unknown>[]) =>
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
  })

const errorResponse = () =>
  HttpResponse.json(
    { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
    { status: 403 },
  )

const importModules = async () => {
  vi.resetModules()
  const [{ usePopularMovies, invalidatePopularMovies }, { getPopularMovies }] =
    await Promise.all([
      import('./usePopularMovies'),
      import('../api/getPopularMovies'),
    ])
  return { usePopularMovies, invalidatePopularMovies, getPopularMovies }
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('usePopularMovies', () => {
  it('отдаёт замапленные данные с position/positionDiff', async () => {
    server.use(http.get(ENDPOINT, () => successResponse([listItem()])))
    const { usePopularMovies } = await importModules()

    const Probe = () => {
      const movies = usePopularMovies()
      return createElement(
        'ul',
        null,
        movies.map(m =>
          createElement(
            'li',
            { key: m.id },
            `${m.title} #${m.position} (${m.positionDiff})`,
          ),
        ),
      )
    }

    await act(async () => {
      render(
        createElement(Suspense, { fallback: 'loading' }, createElement(Probe)),
      )
    })

    expect(screen.getByText('Test Movie #1 (2)')).toBeInTheDocument()
  })

  it('invalidatePopularMovies бьёт РОВНО по тому же ключу, что использует хук', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return errorResponse()
      }),
    )
    const { getPopularMovies, invalidatePopularMovies } = await importModules()

    const params = { slug: 'popular', limit: 10 }
    await expect(getPopularMovies(params)).rejects.toThrow()
    expect(requests).toBe(1)

    invalidatePopularMovies()

    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return successResponse([listItem({ movie: movieDoc({ id: 2 }) })])
      }),
    )

    await getPopularMovies(params)
    expect(requests).toBe(2)
  })

  it('домашний rail и страница /popular шарят один сетевой запрос', async () => {
    let requests = 0
    server.use(
      http.get(ENDPOINT, () => {
        requests += 1
        return successResponse([listItem()])
      }),
    )
    const { usePopularMovies } = await importModules()

    const Probe = () => {
      usePopularMovies()
      return null
    }

    await act(async () => {
      render(
        createElement(
          Suspense,
          { fallback: 'loading' },
          createElement(Probe),
          createElement(Probe),
        ),
      )
    })

    expect(requests).toBe(1)
  })
})
