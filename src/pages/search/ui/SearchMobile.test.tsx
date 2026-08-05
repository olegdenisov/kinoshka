import { useEffect } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '../../../test/setup'
import { SearchMobile } from './SearchMobile'

/** Читает текущую строку query из роутера — способ проверить, что запись в URL реально произошла. */
let lastSearch = ''
const LocationProbe = () => {
  const { search } = useLocation()
  useEffect(() => {
    lastSearch = search
  }, [search])
  return null
}

const SEARCH_ENDPOINT = '*/v1.4/movie/search'
const CATALOG_ENDPOINT = '*/v1.5/movie'

const searchDoc = (name: string, id: number) => ({
  id,
  name,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'драма' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
})

const catalogDoc = (name: string, id: number) => ({
  id,
  name,
  year: 2023,
  type: 'movie',
  rating: { kp: 7.2, imdb: 7.0 },
  genres: [{ name: 'драма' }],
  movieLength: 100,
  poster: { previewUrl: 'https://example.com/catalog.jpg' },
})

const mockSearch = (docs: Record<string, unknown>[], overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(SEARCH_ENDPOINT, () =>
      HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10, ...overrides }),
    ),
  )
}

const mockCatalog = (docs: Record<string, unknown>[], overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(CATALOG_ENDPOINT, () =>
      HttpResponse.json({
        docs,
        limit: 10,
        next: null,
        hasNext: false,
        hasPrev: false,
        total: docs.length,
        ...overrides,
      }),
    ),
  )
}

const renderSearchMobile = async (initialEntries: string[]) => {
  lastSearch = ''
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={initialEntries}>
        <SearchMobile />
        <LocationProbe />
      </MemoryRouter>,
    )
  })
  return result!
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('SearchMobile — режим search (?q задан)', () => {
  it('рендерит результаты из search-эндпоинта, не из CATALOG-мока', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 111)])
    mockCatalog([catalogDoc('Should Not Appear', 112)])

    await renderSearchMobile(['/search?q=matrix'])

    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)
  })

  it('дизейблит триггеры Filters/Sort в режиме search', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 113)])

    await renderSearchMobile(['/search?q=matrix'])

    expect(screen.getByRole('button', { name: /Filters/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Sort/ })).toBeDisabled()
  })
})

describe('SearchMobile — режим catalog (без ?q)', () => {
  it('рендерит результаты из catalog-эндпоинта, не из CATALOG-мока', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)])
    mockSearch([searchDoc('Should Not Appear', 202)])

    await renderSearchMobile(['/search?genres=Drama'])

    expect(screen.getAllByText('Dune Part Two').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)

    expect(screen.getByRole('button', { name: /Filters/ })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Sort/ })).not.toBeDisabled()
  })
})

describe('SearchMobile — пустой результат', () => {
  it('показывает EmptyState с эхом запроса', async () => {
    mockSearch([])

    await renderSearchMobile(['/search?q=nonexistent-movie-xyz'])

    expect(screen.getByText(/Ничего не найдено по «nonexistent-movie-xyz»/)).toBeInTheDocument()
  })
})

describe('SearchMobile — существующий BottomSheet фильтров пишет в URL', () => {
  it('выбор типа в BottomSheet фильтров пишет ?type в URL (replace)', async () => {
    mockCatalog([catalogDoc('Oppenheimer', 301)])

    await renderSearchMobile(['/search'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Movies' }))
    })

    expect(lastSearch).toContain('type=movie')
  })

  it('выбор сортировки в BottomSheet сортировки пишет ?sort в URL', async () => {
    mockCatalog([catalogDoc('Interstellar', 302)])

    await renderSearchMobile(['/search'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sort/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Newest/ }))
    })

    expect(lastSearch).toContain('sort=Newest')
  })
})
