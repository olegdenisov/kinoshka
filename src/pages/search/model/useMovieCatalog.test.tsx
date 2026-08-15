import { filtersToParams } from '@features/catalog-filter'
import type { FilterState } from '@features/catalog-filter'
import { AsyncBoundary } from '@shared/ui'
import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ComponentType } from 'react'

import { server } from '../../../test/setup'
import type {
  MovieCatalogParams,
  useMovieCatalog as UseMovieCatalog,
} from './useMovieCatalog'

// Оба фетчера (getSearchMovies/getMoviesPage) кешируют промисы в module-scope Map —
// свежий модуль на каждый тест, чтобы одинаковые (query,page)/(params,page) не залипали.
const importUseMovieCatalog = async () => {
  vi.resetModules()
  const mod = await import('./useMovieCatalog')
  return mod.useMovieCatalog
}

const EMPTY_FILTERS: FilterState = {
  type: null,
  genres: [],
  yearFrom: null,
  yearTo: null,
  rating: null,
}

const SEARCH_ENDPOINT = '*/v1.5/movie/search'
const CATALOG_ENDPOINT = '*/v1.5/movie'

const searchDoc = (name: string) => ({
  id: 1,
  name,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
})

const catalogDoc = (name: string) => ({
  id: 2,
  name,
  year: 2023,
  type: 'movie',
  rating: { kp: 7.2, imdb: 7.0 },
  genres: [{ name: 'drama' }],
  movieLength: 100,
  poster: { previewUrl: 'https://example.com/catalog.jpg' },
})

const mockSearch = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  let request: Request | undefined
  server.use(
    http.get(SEARCH_ENDPOINT, ({ request: req }) => {
      request = req
      return HttpResponse.json({
        docs,
        total: docs.length,
        page: 1,
        pages: 3,
        limit: 12,
        ...overrides,
      })
    }),
  )
  return () => request
}

const mockCatalog = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  let request: Request | undefined
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request: req }) => {
      request = req
      return HttpResponse.json({
        docs,
        limit: 12,
        next: null,
        hasNext: false,
        hasPrev: false,
        total: 25,
        ...overrides,
      })
    }),
  )
  return () => request
}

type ProbeProps = {
  useMovieCatalog: typeof UseMovieCatalog
  params: MovieCatalogParams
}

const Probe: ComponentType<ProbeProps> = ({ useMovieCatalog, params }) => {
  const result = useMovieCatalog(params)
  return (
    <div>
      <span data-testid='mode'>{result.mode}</span>
      <span data-testid='totalPages'>{result.totalPages}</span>
      <ul data-testid='movies'>
        {result.movies.map(m => (
          <li key={m.id}>{m.title}</li>
        ))}
      </ul>
    </div>
  )
}

// React 19's `use()` suspends synchronously during the initial render; testing-library's
// (synchronous) `act` inside plain `render()` warns "act call was not awaited" and the
// eventual re-render after the promise resolves never flushes. Wrapping in `await act(async …)`
// gives React's scheduler a real async act scope to await the pending suspended work.
const renderProbe = async (
  useMovieCatalog: typeof UseMovieCatalog,
  params: MovieCatalogParams,
) => {
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <AsyncBoundary>
        <Probe useMovieCatalog={useMovieCatalog} params={params} />
      </AsyncBoundary>,
    )
  })
  return result!
}

const rerenderProbe = async (
  rerender: ReturnType<typeof render>['rerender'],
  useMovieCatalog: typeof UseMovieCatalog,
  params: MovieCatalogParams,
) => {
  await act(async () => {
    rerender(
      <AsyncBoundary>
        <Probe useMovieCatalog={useMovieCatalog} params={params} />
      </AsyncBoundary>,
    )
  })
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('useMovieCatalog — непустой query → режим search', () => {
  it('игнорирует filters, totalPages — из search-ответа (pages)', async () => {
    const getSearchRequest = mockSearch([searchDoc('Matrix')], { pages: 7 })
    const catalogRequest = mockCatalog([catalogDoc('Should Not Appear')])
    const useMovieCatalog = await importUseMovieCatalog()

    await renderProbe(useMovieCatalog, {
      query: 'matrix',
      filters: { ...EMPTY_FILTERS, genres: ['Drama'] },
      sort: 'Newest',
      page: 1,
    })

    expect(screen.getByTestId('mode')).toHaveTextContent('search')
    expect(screen.getByTestId('totalPages')).toHaveTextContent('7')
    expect(screen.getByTestId('movies')).toHaveTextContent('Matrix')

    const url = new URL(getSearchRequest()!.url)
    expect(url.searchParams.get('query')).toBe('matrix')
    expect(catalogRequest()).toBeUndefined()
  })
})

describe('useMovieCatalog — пустой query → режим catalog', () => {
  it('вызывает getMoviesPage(filtersToParams(filters, sort), page), totalPages — из total', async () => {
    const getCatalogRequest = mockCatalog([catalogDoc('Dune')], { total: 15 })
    const searchRequest = mockSearch([searchDoc('Should Not Appear')])
    const useMovieCatalog = await importUseMovieCatalog()

    await renderProbe(useMovieCatalog, {
      query: '',
      filters: { ...EMPTY_FILTERS, type: 'movie' },
      sort: 'Newest',
      page: 1,
    })

    expect(screen.getByTestId('mode')).toHaveTextContent('catalog')
    expect(screen.getByTestId('totalPages')).toHaveTextContent('2')
    expect(screen.getByTestId('movies')).toHaveTextContent('Dune')

    const url = new URL(getCatalogRequest()!.url)
    expect(url.searchParams.getAll('type')).toEqual(['movie'])
    expect(url.searchParams.getAll('sortField')).toEqual(['year'])
    expect(searchRequest()).toBeUndefined()
  })

  it('query из одних пробелов трактуется как пустой (режим catalog)', async () => {
    mockCatalog([catalogDoc('Dune')])
    const useMovieCatalog = await importUseMovieCatalog()

    await renderProbe(useMovieCatalog, {
      query: '   ',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })

    expect(screen.getByTestId('mode')).toHaveTextContent('catalog')
  })
})

describe('useMovieCatalog — единый результат { movies, mode, totalPages }', () => {
  it('форма результата одинакова в обоих режимах', async () => {
    mockSearch([searchDoc('Matrix')], { pages: 2 })
    const useMovieCatalogSearch = await importUseMovieCatalog()
    const { unmount } = await renderProbe(useMovieCatalogSearch, {
      query: 'matrix',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    expect(screen.getByTestId('mode')).toHaveTextContent('search')
    unmount()

    mockCatalog([catalogDoc('Dune')], { total: 5 })
    const useMovieCatalogCatalog = await importUseMovieCatalog()
    await renderProbe(useMovieCatalogCatalog, {
      query: '',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })

    expect(screen.getByTestId('mode')).toHaveTextContent('catalog')
    expect(screen.getByTestId('totalPages')).toHaveTextContent('1')
  })
})

describe('useMovieCatalog — смена page/sort/фильтров меняет запрос', () => {
  it('смена page (search) — новый запрос со следующей страницей', async () => {
    const getSearchRequest = mockSearch([searchDoc('Matrix Page1')], {
      pages: 2,
    })
    const useMovieCatalog = await importUseMovieCatalog()

    const { rerender } = await renderProbe(useMovieCatalog, {
      query: 'matrix',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    expect(screen.getByTestId('movies')).toHaveTextContent('Matrix Page1')
    expect(new URL(getSearchRequest()!.url).searchParams.get('page')).toBe('1')

    const getSearchRequest2 = mockSearch([searchDoc('Matrix Page2')], {
      pages: 2,
    })
    await rerenderProbe(rerender, useMovieCatalog, {
      query: 'matrix',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 2,
    })

    expect(screen.getByTestId('movies')).toHaveTextContent('Matrix Page2')
    expect(new URL(getSearchRequest2()!.url).searchParams.get('page')).toBe('2')
  })

  it('смена sort/фильтров (catalog) — новый запрос с новыми параметрами', async () => {
    const getRequest1 = mockCatalog([catalogDoc('Dune')])
    const useMovieCatalog = await importUseMovieCatalog()

    const { rerender } = await renderProbe(useMovieCatalog, {
      query: '',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    expect(screen.getByTestId('movies')).toHaveTextContent('Dune')
    expect(
      new URL(getRequest1()!.url).searchParams.getAll('sortField'),
    ).toEqual([])

    const getRequest2 = mockCatalog([catalogDoc('Highest Rated Movie')])
    await rerenderProbe(rerender, useMovieCatalog, {
      query: '',
      filters: { ...EMPTY_FILTERS, rating: 8 },
      sort: 'Highest rated',
      page: 1,
    })

    expect(screen.getByTestId('movies')).toHaveTextContent(
      'Highest Rated Movie',
    )
    const url2 = new URL(getRequest2()!.url)
    expect(url2.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url2.searchParams.getAll('rating.kp')).toEqual(['8-10'])
  })
})

describe('invalidateMovieCatalog — Task 5 (retry реально бьёт в сеть)', () => {
  // Механика самого кэша (TTL/cooldown/sessionStorage, per-params изоляция) полностью
  // покрыта createCachedFetcher.test.ts/getMoviesPage.test.ts. Здесь — только то, что
  // invalidateMovieCatalog бьёт РОВНО по тому же кэш-ключу и той же ветке
  // (trimmedQuery ? search : catalog), что использует сам useMovieCatalog выше (через
  // getSearchMovies/getMoviesPage напрямую — see useTopRatedMovies.test.ts за тем же
  // паттерном), — иначе Retry на /search молча продолжал бы отдавать старый
  // rejected-промис из cooldown (ERROR_CACHE_TTL_MS).
  const errorResponse = () =>
    HttpResponse.json(
      { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
      { status: 403 },
    )

  // Свежий модуль на каждый тест — оба фетчера кешируют промисы в module-scope Map.
  const importModules = async () => {
    vi.resetModules()
    const [{ invalidateMovieCatalog }, { getSearchMovies, getMoviesPage }] =
      await Promise.all([
        import('./useMovieCatalog'),
        import('@entities/movie'),
      ])
    return { invalidateMovieCatalog, getSearchMovies, getMoviesPage }
  }

  it('search-режим (непустой query): rejected getSearchMovies → invalidateMovieCatalog → повторный вызов реально идёт в сеть', async () => {
    let requests = 0
    server.use(
      http.get(SEARCH_ENDPOINT, () => {
        requests += 1
        return errorResponse()
      }),
    )
    const { invalidateMovieCatalog, getSearchMovies } = await importModules()

    const params: MovieCatalogParams = {
      query: 'matrix-retry',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    }

    await expect(
      getSearchMovies({ query: 'matrix-retry', page: 1 }),
    ).rejects.toThrow()
    expect(requests).toBe(1)

    invalidateMovieCatalog(params)

    server.use(
      http.get(SEARCH_ENDPOINT, () => {
        requests += 1
        return HttpResponse.json({
          docs: [searchDoc('Recovered')],
          total: 1,
          page: 1,
          pages: 1,
          limit: 12,
        })
      }),
    )

    await getSearchMovies({ query: 'matrix-retry', page: 1 })
    expect(requests).toBe(2)
  })

  it('catalog-режим (пустой query): rejected getMoviesPage → invalidateMovieCatalog → повторный вызов реально идёт в сеть', async () => {
    let requests = 0
    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        requests += 1
        return errorResponse()
      }),
    )
    const { invalidateMovieCatalog, getMoviesPage } = await importModules()

    const filters = { ...EMPTY_FILTERS, type: 'movie' as const }
    const params: MovieCatalogParams = { query: '', filters, sort: '', page: 1 }
    // Тот же filtersToParams(filters, sort), что invalidateMovieCatalog вызывает внутри
    // себя — иначе тест мог бы пройти, даже если invalidate бьёт не по тому ключу.
    const catalogParams = filtersToParams(filters, '')

    await expect(getMoviesPage(catalogParams, 1)).rejects.toThrow()
    expect(requests).toBe(1)

    invalidateMovieCatalog(params)

    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        requests += 1
        return HttpResponse.json({
          docs: [catalogDoc('Recovered')],
          limit: 12,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 1,
        })
      }),
    )

    await getMoviesPage(catalogParams, 1)
    expect(requests).toBe(2)
  })

  it('invalidateMovieCatalog(search-params) не задевает независимую catalog-запись getMoviesPage', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, () =>
        HttpResponse.json({
          docs: [searchDoc('Search Hit')],
          total: 1,
          page: 1,
          pages: 1,
          limit: 12,
        }),
      ),
      http.get(CATALOG_ENDPOINT, () =>
        HttpResponse.json({
          docs: [catalogDoc('Catalog Hit')],
          limit: 12,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 1,
        }),
      ),
    )
    const { invalidateMovieCatalog, getSearchMovies, getMoviesPage } =
      await importModules()

    const searchParams: MovieCatalogParams = {
      query: 'isolation-probe',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    }

    await getSearchMovies({ query: 'isolation-probe', page: 1 })
    await getMoviesPage({}, 1)

    let catalogRequests = 0
    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        catalogRequests += 1
        return HttpResponse.json({
          docs: [catalogDoc('Catalog Hit')],
          limit: 12,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 1,
        })
      }),
    )

    invalidateMovieCatalog(searchParams)

    // catalog-запись (пустые params) не задета invalidateMovieCatalog(searchParams) —
    // из кэша, без сети.
    await getMoviesPage({}, 1)
    expect(catalogRequests).toBe(0)
  })
})
