import { act, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../test/setup'
import { SearchDesktop } from './SearchDesktop'

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

const renderSearchDesktop = async (initialEntries: string[]) => {
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={initialEntries}>
        <SearchDesktop />
      </MemoryRouter>,
    )
  })
  return result!
}

beforeEach(() => {
  sessionStorage.clear()
})

describe('SearchDesktop — режим search (?q задан)', () => {
  it('рендерит грид из search-эндпоинта и дизейблит сайдбар фильтров', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)])
    mockCatalog([catalogDoc('Should Not Appear', 102)])

    await renderSearchDesktop(['/search?q=matrix-revolutions'])

    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)

    // SearchSidebar задизейблена целиком (Variant A: query и фильтры не сочетаются)
    const sidebar = document.querySelector('aside')!
    const typeButtons = within(sidebar).getAllByRole('button', { name: /Movies|Series|Anime/ })
    typeButtons.forEach((btn) => expect(btn).toBeDisabled())
  })
})

describe('SearchDesktop — режим catalog (без ?q, есть фильтры)', () => {
  it('рендерит грид из catalog-эндпоинта, сайдбар активен', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)])
    mockSearch([searchDoc('Should Not Appear', 202)])

    await renderSearchDesktop(['/search?genres=Drama'])

    expect(screen.getAllByText('Dune Part Two').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)

    const sidebar = document.querySelector('aside')!
    const typeButtons = within(sidebar).getAllByRole('button', { name: /Movies|Series|Anime/ })
    typeButtons.forEach((btn) => expect(btn).not.toBeDisabled())
  })
})

describe('SearchDesktop — пустой результат', () => {
  it('показывает EmptyState с эхом запроса', async () => {
    mockSearch([])

    await renderSearchDesktop(['/search?q=nonexistent-movie-xyz'])

    expect(screen.getByText(/Ничего не найдено по «nonexistent-movie-xyz»/)).toBeInTheDocument()
  })
})

describe('SearchDesktop — a11y счётчика результатов', () => {
  it('счётчик результатов помечен aria-live="polite"', async () => {
    mockCatalog([catalogDoc('Oppenheimer', 301)])

    const { container } = await renderSearchDesktop(['/search?genres=Action'])

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
    expect(liveRegion).toHaveTextContent(/page 1 of/i)
  })
})
