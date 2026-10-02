import { EMPTY_FILTERS } from '@features/catalog-filter'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { type MovieCatalogParams, useMovieCatalog } from './useMovieCatalog'

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

const mockForbidden = (endpoint: string) => {
  const counts = { requests: 0 }
  server.use(
    http.get(endpoint, () => {
      counts.requests += 1
      return HttpResponse.json(
        { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
        { status: 403 },
      )
    }),
  )
  return counts
}

const renderCatalog = (initialProps: MovieCatalogParams) =>
  renderHook((props: MovieCatalogParams) => useMovieCatalog(props), {
    initialProps,
  })

const titles = (result: { current: ReturnType<typeof useMovieCatalog> }) =>
  result.current.data?.movies.map(m => m.title)

describe('useMovieCatalog — непустой query → режим search', () => {
  it('игнорирует filters, totalPages — из search-ответа (pages)', async () => {
    const getSearchRequest = mockSearch([searchDoc('Matrix')], { pages: 7 })
    const catalogRequest = mockCatalog([catalogDoc('Should Not Appear')])

    const { result } = renderCatalog({
      query: 'matrix',
      filters: { ...EMPTY_FILTERS, genres: ['Drama'] },
      sort: 'Newest',
      page: 1,
    })

    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.mode).toBe('search')
    expect(result.current.data?.totalPages).toBe(7)
    expect(titles(result)).toEqual(['Matrix'])
    expect(result.current.isFetching).toBe(false)

    const url = new URL(getSearchRequest()!.url)
    expect(url.searchParams.get('query')).toBe('matrix')
    expect(catalogRequest()).toBeUndefined()
  })
})

describe('useMovieCatalog — пустой query → режим catalog', () => {
  it('запрос каталога по filtersToParams(filters, sort), totalPages — из total', async () => {
    const getCatalogRequest = mockCatalog([catalogDoc('Dune')], { total: 15 })
    const searchRequest = mockSearch([searchDoc('Should Not Appear')])

    const { result } = renderCatalog({
      query: '',
      filters: { ...EMPTY_FILTERS, type: 'movie' },
      sort: 'Newest',
      page: 1,
    })

    await waitFor(() => expect(result.current.data).toBeDefined())

    expect(result.current.data?.mode).toBe('catalog')
    expect(result.current.data?.totalPages).toBe(2)
    expect(titles(result)).toEqual(['Dune'])

    const url = new URL(getCatalogRequest()!.url)
    expect(url.searchParams.getAll('type')).toEqual(['movie'])
    expect(url.searchParams.getAll('sortField')).toEqual(['year'])
    expect(searchRequest()).toBeUndefined()
  })

  it('query из одних пробелов трактуется как пустой (режим catalog)', async () => {
    mockCatalog([catalogDoc('Dune')])

    const { result } = renderCatalog({
      query: '   ',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })

    await waitFor(() => expect(result.current.data?.mode).toBe('catalog'))
  })
})

describe('useMovieCatalog — смена параметров (stale-while-fetching)', () => {
  it('смена page (search) — новый запрос, прежняя выдача держится, пока он идёт', async () => {
    const getSearchRequest = mockSearch([searchDoc('Matrix Page1')], {
      pages: 2,
    })
    const { result, rerender } = renderCatalog({
      query: 'matrix',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    await waitFor(() => expect(titles(result)).toEqual(['Matrix Page1']))
    expect(new URL(getSearchRequest()!.url).searchParams.get('page')).toBe('1')

    const getSearchRequest2 = mockSearch([searchDoc('Matrix Page2')], {
      pages: 2,
    })
    rerender({ query: 'matrix', filters: EMPTY_FILTERS, sort: '', page: 2 })

    // уже в первом рендере нового ключа: старые данные + isFetching, не isLoading
    expect(titles(result)).toEqual(['Matrix Page1'])
    expect(result.current.isFetching).toBe(true)
    expect(result.current.isLoading).toBe(false)

    await waitFor(() => expect(titles(result)).toEqual(['Matrix Page2']))
    expect(result.current.isFetching).toBe(false)
    expect(new URL(getSearchRequest2()!.url).searchParams.get('page')).toBe('2')
  })

  it('смена sort/фильтров (catalog) — новый запрос с новыми параметрами', async () => {
    const getRequest1 = mockCatalog([catalogDoc('Dune')])
    const { result, rerender } = renderCatalog({
      query: '',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    await waitFor(() => expect(titles(result)).toEqual(['Dune']))
    expect(
      new URL(getRequest1()!.url).searchParams.getAll('sortField'),
    ).toEqual([])

    const getRequest2 = mockCatalog([catalogDoc('Highest Rated Movie')])
    rerender({
      query: '',
      filters: { ...EMPTY_FILTERS, rating: 8 },
      sort: 'Highest rated',
      page: 1,
    })

    await waitFor(() => expect(titles(result)).toEqual(['Highest Rated Movie']))
    const url2 = new URL(getRequest2()!.url)
    expect(url2.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url2.searchParams.getAll('rating.kp')).toEqual(['8-10'])
  })

  it('переключение режима catalog → search держит прежнюю сетку до ответа поиска', async () => {
    mockCatalog([catalogDoc('Dune')])
    const { result, rerender } = renderCatalog({
      query: '',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    await waitFor(() => expect(result.current.data?.mode).toBe('catalog'))

    let resolvePending: ((response: Response) => void) | undefined
    server.use(
      http.get(
        SEARCH_ENDPOINT,
        () =>
          new Promise<Response>(resolve => {
            resolvePending = resolve
          }),
      ),
    )
    rerender({ query: 'matrix', filters: EMPTY_FILTERS, sort: '', page: 1 })

    expect(result.current.data?.mode).toBe('catalog')
    expect(titles(result)).toEqual(['Dune'])
    expect(result.current.isFetching).toBe(true)
    expect(result.current.isLoading).toBe(false)

    await waitFor(() => expect(resolvePending).toBeDefined())
    await act(async () => {
      resolvePending!(
        HttpResponse.json({
          docs: [searchDoc('Matrix')],
          total: 1,
          page: 1,
          pages: 1,
          limit: 12,
        }),
      )
    })

    await waitFor(() => expect(result.current.data?.mode).toBe('search'))
    expect(titles(result)).toEqual(['Matrix'])
  })

  it('возврат к уже загруженным параметрам — из кеша, без запроса', async () => {
    let requests = 0
    server.use(
      http.get(SEARCH_ENDPOINT, ({ request }) => {
        requests += 1
        const page = new URL(request.url).searchParams.get('page')
        return HttpResponse.json({
          docs: [searchDoc(`Page ${page}`)],
          total: 2,
          page: Number(page),
          pages: 2,
          limit: 12,
        })
      }),
    )
    const params = { query: 'matrix', filters: EMPTY_FILTERS, sort: '' }
    const { result, rerender } = renderCatalog({ ...params, page: 1 })
    await waitFor(() => expect(titles(result)).toEqual(['Page 1']))

    rerender({ ...params, page: 2 })
    await waitFor(() => expect(titles(result)).toEqual(['Page 2']))

    rerender({ ...params, page: 1 })
    expect(titles(result)).toEqual(['Page 1'])
    expect(result.current.isFetching).toBe(false)
    expect(requests).toBe(2)
  })
})

describe('useMovieCatalog — ошибки и Retry', () => {
  it('search-режим: 403 → isError, refetch реально идёт в сеть', async () => {
    const forbidden = mockForbidden(SEARCH_ENDPOINT)
    const { result } = renderCatalog({
      query: 'matrix-retry',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(forbidden.requests).toBe(1)

    const getRequest = mockSearch([searchDoc('Recovered')])
    act(() => result.current.refetch())

    await waitFor(() => expect(titles(result)).toEqual(['Recovered']))
    expect(result.current.isError).toBe(false)
    expect(getRequest()).toBeDefined()
  })

  it('catalog-режим: 403 → isError, refetch перезапрашивает шаг курсора', async () => {
    const forbidden = mockForbidden(CATALOG_ENDPOINT)
    const { result } = renderCatalog({
      query: '',
      filters: { ...EMPTY_FILTERS, rating: 6 },
      sort: '',
      page: 1,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(forbidden.requests).toBe(1)

    mockCatalog([catalogDoc('Recovered Catalog')])
    act(() => result.current.refetch())

    await waitFor(() => expect(titles(result)).toEqual(['Recovered Catalog']))
  })
})
