import { EMPTY_FILTERS } from '@features/catalog-filter'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import { useMovieCatalog } from './useMovieCatalog'
import type { MovieCatalogParams } from './useMovieCatalog'

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

const searchBody = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => ({
  docs,
  total: docs.length,
  page: 1,
  pages: 3,
  limit: 12,
  ...overrides,
})

const catalogBody = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => ({
  docs,
  limit: 12,
  next: null,
  hasNext: false,
  hasPrev: false,
  total: 25,
  ...overrides,
})

const mockSearch = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  const requests: URL[] = []
  server.use(
    http.get(SEARCH_ENDPOINT, ({ request }) => {
      requests.push(new URL(request.url))
      return HttpResponse.json(searchBody(docs, overrides))
    }),
  )
  return requests
}

const mockCatalog = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  const requests: URL[] = []
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request }) => {
      requests.push(new URL(request.url))
      return HttpResponse.json(catalogBody(docs, overrides))
    }),
  )
  return requests
}

const forbidden = () =>
  HttpResponse.json(
    { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
    { status: 403 },
  )

const renderCatalog = (params: MovieCatalogParams) =>
  renderHook((props: MovieCatalogParams) => useMovieCatalog(props), {
    initialProps: params,
    wrapper: createStoreWrapper(),
  })

const titles = (result: { current: ReturnType<typeof useMovieCatalog> }) =>
  result.current.data?.movies.map(m => m.title)

describe('useMovieCatalog — непустой query → режим search', () => {
  it('игнорирует filters, totalPages — из search-ответа (pages)', async () => {
    const searchRequests = mockSearch([searchDoc('Matrix')], { pages: 7 })
    const catalogRequests = mockCatalog([catalogDoc('Should Not Appear')])

    const { result } = renderCatalog({
      query: 'matrix',
      filters: { ...EMPTY_FILTERS, genres: ['Drama'] },
      sort: 'Newest',
      page: 1,
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toMatchObject({ mode: 'search', totalPages: 7 })
    expect(titles(result)).toEqual(['Matrix'])
    expect(searchRequests[0].searchParams.get('query')).toBe('matrix')
    expect(catalogRequests).toHaveLength(0)
  })
})

describe('useMovieCatalog — пустой query → режим catalog', () => {
  it('запрос с filtersToParams(filters, sort), totalPages — из total', async () => {
    const catalogRequests = mockCatalog([catalogDoc('Dune')], { total: 15 })
    const searchRequests = mockSearch([searchDoc('Should Not Appear')])

    const { result } = renderCatalog({
      query: '',
      filters: { ...EMPTY_FILTERS, type: 'movie' },
      sort: 'Newest',
      page: 1,
    })

    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data).toMatchObject({
      mode: 'catalog',
      totalPages: 2,
    })
    expect(titles(result)).toEqual(['Dune'])
    expect(catalogRequests[0].searchParams.getAll('type')).toEqual(['movie'])
    expect(catalogRequests[0].searchParams.getAll('sortField')).toEqual([
      'year',
    ])
    expect(searchRequests).toHaveLength(0)
  })

  it('query из одних пробелов трактуется как пустой (режим catalog)', async () => {
    const catalogRequests = mockCatalog([catalogDoc('Dune')])

    const { result } = renderCatalog({
      query: '   ',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })

    await waitFor(() => expect(result.current.data?.mode).toBe('catalog'))
    expect(catalogRequests).toHaveLength(1)
  })
})

describe('useMovieCatalog — смена аргументов', () => {
  it('смена page (search) — новый запрос, старые данные держатся до ответа (isUpdating)', async () => {
    mockSearch([searchDoc('Matrix Page1')], { pages: 2 })

    const { result, rerender } = renderCatalog({
      query: 'matrix',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    await waitFor(() => expect(titles(result)).toEqual(['Matrix Page1']))
    expect(result.current.isUpdating).toBe(false)

    const page2Requests = mockSearch([searchDoc('Matrix Page2')], { pages: 2 })
    rerender({ query: 'matrix', filters: EMPTY_FILTERS, sort: '', page: 2 })

    expect(titles(result)).toEqual(['Matrix Page1'])
    expect(result.current.isUpdating).toBe(true)
    expect(result.current.isLoading).toBe(false)

    await waitFor(() => expect(titles(result)).toEqual(['Matrix Page2']))
    expect(result.current.isUpdating).toBe(false)
    expect(page2Requests[0].searchParams.get('page')).toBe('2')
  })

  it('смена sort/фильтров (catalog) — новый запрос с новыми параметрами', async () => {
    mockCatalog([catalogDoc('Dune')])

    const { result, rerender } = renderCatalog({
      query: '',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    await waitFor(() => expect(titles(result)).toEqual(['Dune']))

    const requests = mockCatalog([catalogDoc('Highest Rated Movie')])
    rerender({
      query: '',
      filters: { ...EMPTY_FILTERS, rating: 8 },
      sort: 'Highest rated',
      page: 1,
    })

    await waitFor(() => expect(titles(result)).toEqual(['Highest Rated Movie']))
    expect(requests[0].searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(requests[0].searchParams.getAll('rating.kp')).toEqual(['8-10'])
  })

  it('новый объект filters с тем же содержимым не перезапрашивает каталог', async () => {
    const requests = mockCatalog([catalogDoc('Dune')])

    const { result, rerender } = renderCatalog({
      query: '',
      filters: { ...EMPTY_FILTERS, genres: ['драма'] },
      sort: '',
      page: 1,
    })
    await waitFor(() => expect(titles(result)).toEqual(['Dune']))

    rerender({
      query: '',
      filters: { ...EMPTY_FILTERS, genres: ['драма'] },
      sort: '',
      page: 1,
    })

    expect(result.current.isFetching).toBe(false)
    expect(requests).toHaveLength(1)
  })

  it('переключение каталог → поиск: сетка каталога держится, mode/query — от аргументов этих data', async () => {
    mockCatalog([catalogDoc('Dune')])

    const { result, rerender } = renderCatalog({
      query: '',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })
    await waitFor(() => expect(titles(result)).toEqual(['Dune']))

    mockSearch([searchDoc('Matrix')])
    rerender({ query: 'matrix', filters: EMPTY_FILTERS, sort: '', page: 1 })

    expect(titles(result)).toEqual(['Dune'])
    // прежняя сетка каталога — и режим её, иначе пустой каталог показал бы «ничего не найдено по …»
    expect(result.current.data).toMatchObject({ mode: 'catalog', query: '' })
    expect(result.current.isUpdating).toBe(true)

    await waitFor(() => expect(titles(result)).toEqual(['Matrix']))
    expect(result.current.data).toMatchObject({
      mode: 'search',
      query: 'matrix',
    })
  })
})

describe('useMovieCatalog — ошибка и refetch', () => {
  it('ошибка → refetch реально уходит в сеть и отдаёт данные', async () => {
    let requests = 0
    server.use(
      http.get(SEARCH_ENDPOINT, () => {
        requests += 1
        return requests === 1
          ? forbidden()
          : HttpResponse.json(searchBody([searchDoc('Recovered')]))
      }),
    )

    const { result } = renderCatalog({
      query: 'matrix-retry',
      filters: EMPTY_FILTERS,
      sort: '',
      page: 1,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toMatchObject({ status: 403 })

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => expect(titles(result)).toEqual(['Recovered']))
    expect(requests).toBe(2)
  })

  it('catalog-режим: ошибка → refetch реально уходит в сеть', async () => {
    let requests = 0
    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        requests += 1
        return requests === 1
          ? forbidden()
          : HttpResponse.json(catalogBody([catalogDoc('Recovered')]))
      }),
    )

    const { result } = renderCatalog({
      query: '',
      filters: { ...EMPTY_FILTERS, type: 'movie' },
      sort: '',
      page: 1,
    })

    await waitFor(() => expect(result.current.isError).toBe(true))

    await act(async () => {
      result.current.refetch()
    })

    await waitFor(() => expect(titles(result)).toEqual(['Recovered']))
    expect(requests).toBe(2)
  })
})
