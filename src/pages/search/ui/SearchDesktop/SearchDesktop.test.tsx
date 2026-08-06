import { useEffect } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../test/setup'
import { SearchDesktop } from './SearchDesktop'

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

const renderSearchDesktop = async (initialEntries: string[]) => {
  lastSearch = ''
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={initialEntries}>
        <SearchDesktop />
        <LocationProbe />
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

    // SearchSidebar задизейблена целиком (Variant A: query и фильтры не сочетаются) —
    // проверяем не только Type-радиокнопки, но и остальные интерактивные контролы сайдбара
    // (Genre-чипы, Rating-кнопки, Reset), чтобы поломка проброса disabled на любую из них
    // не проходила незамеченной.
    const sidebar = document.querySelector('aside')!
    const typeButtons = within(sidebar).getAllByRole('button', { name: /Movies|Series|Anime/ })
    typeButtons.forEach((btn) => expect(btn).toBeDisabled())

    const genreButtons = within(sidebar).getAllByRole('button', { name: /Action|Drama|Sci-Fi/ })
    genreButtons.forEach((btn) => expect(btn).toBeDisabled())

    const ratingButtons = within(sidebar).getAllByRole('button', { name: /^\d\+$/ })
    expect(ratingButtons.length).toBeGreaterThan(0)
    ratingButtons.forEach((btn) => expect(btn).toBeDisabled())

    expect(within(sidebar).getByRole('button', { name: 'Reset filters' })).toBeDisabled()

    // Сортировка тоже задизейблена в search-режиме (Variant A) — sortDisabled=isSearchMode,
    // проброшенный SearchDesktop → SearchControls → SortSelect.
    expect(screen.getByRole('button', { name: /^Sort/ })).toBeDisabled()
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

    const genreButtons = within(sidebar).getAllByRole('button', { name: /Action|Drama|Sci-Fi/ })
    genreButtons.forEach((btn) => expect(btn).not.toBeDisabled())

    const ratingButtons = within(sidebar).getAllByRole('button', { name: /^\d\+$/ })
    ratingButtons.forEach((btn) => expect(btn).not.toBeDisabled())

    expect(within(sidebar).getByRole('button', { name: 'Reset filters' })).not.toBeDisabled()

    // Сортировка активна вне search-режима.
    expect(screen.getByRole('button', { name: /^Sort/ })).not.toBeDisabled()
  })
})

describe('SearchDesktop — ошибка фетчера (403/квота) достигает AsyncBoundary', () => {
  it('реджект от search-эндпоинта рендерит ErrorState вместо краша страницы', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, () =>
        HttpResponse.json({ statusCode: 403, message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
      ),
    )

    await renderSearchDesktop(['/search?q=quota-exceeded-probe'])

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument()
    // Заголовок/шапка страницы остаются — падает только контент внутри AsyncBoundary.
    expect(screen.getByPlaceholderText('Search movies, series, anime…')).toBeInTheDocument()
  })
})

describe('SearchDesktop — пустой результат', () => {
  it('показывает EmptyState с эхом запроса', async () => {
    mockSearch([])

    await renderSearchDesktop(['/search?q=nonexistent-movie-xyz'])

    expect(screen.getByText(/Ничего не найдено по «nonexistent-movie-xyz»/)).toBeInTheDocument()
  })
})

describe('SearchDesktop — устаревший/deep-linked ?page вне диапазона', () => {
  it('показывает Pagination рядом с EmptyState, чтобы вернуться на валидную страницу', async () => {
    // Курсор/страница закончились раньше запрошенной — movies: [], но totalPages всё ещё
    // приходит из total (см. getMoviesPage.ts / getSearchMovies.ts). EmptyState сам по себе
    // не даёт способа выбраться — единственный путь назад это Pagination.
    mockSearch([], { pages: 5, total: 50 })

    await renderSearchDesktop(['/search?q=matrix&page=8'])

    expect(screen.getByText(/Ничего не найдено по «matrix»/)).toBeInTheDocument()

    const pageOneBtn = screen.getByRole('button', { name: '1' })
    expect(pageOneBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(pageOneBtn)
    })

    expect(lastSearch).toContain('page=1')
  })

  it('не рендерит Pagination, когда результат пуст по-настоящему (totalPages: 0)', async () => {
    // Отдельный, нигде больше не встречающийся query — иначе in-memory кеш фетчера
    // (module-level Map в createCachedFetcher, ключ = {query, page}) вернул бы промис,
    // засвеченный другим тестом с теми же {query: 'nonexistent-movie-xyz', page: 1}.
    mockSearch([], { pages: 0, total: 0 })

    await renderSearchDesktop(['/search?q=totally-empty-result-set-abc'])

    expect(screen.getByText(/Ничего не найдено по «totally-empty-result-set-abc»/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
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

describe('SearchDesktop — пагинация: page читается из ?page', () => {
  it('page из URL прокидывается в фетчер и отображается в счётчике', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)], { pages: 5, total: 50 })

    await renderSearchDesktop(['/search?q=matrix&page=3'])

    expect(screen.getByText(/page 3 of 5/i)).toBeInTheDocument()
  })

  it('клэмпит page из URL к демо-потолку 10', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)], { pages: 10, total: 100 })

    await renderSearchDesktop(['/search?q=matrix&page=999'])

    expect(screen.getByText(/page 10 of 10/i)).toBeInTheDocument()
  })
})

describe('SearchDesktop — пагинация: клик пишет ?page', () => {
  it('клик по номеру страницы пишет ?page (replace)', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)], { pages: 5, total: 50 })

    await renderSearchDesktop(['/search?q=matrix'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    expect(lastSearch).toContain('page=2')
  })
})

describe('SearchDesktop — пагинация: сброс ?page на 1 при смене q/фильтров', () => {
  it('смена фильтра сбрасывает ?page на 1', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)], { total: 50 })

    await renderSearchDesktop(['/search?genres=Drama&page=3'])
    expect(lastSearch).toContain('page=3')

    const sidebar = document.querySelector('aside')!
    const moviesBtn = within(sidebar).getByRole('button', { name: /^Movies/ })

    await act(async () => {
      fireEvent.click(moviesBtn)
    })

    expect(lastSearch).toContain('page=1')
    expect(lastSearch).not.toContain('page=3')
  })

  it('появление ?q (ввод в Header) сбрасывает ?page на 1', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)], { total: 50 })
    mockSearch([searchDoc('Matrix Revolutions', 101)])

    await renderSearchDesktop(['/search?genres=Drama&page=3'])
    expect(lastSearch).toContain('page=3')

    vi.useFakeTimers()
    try {
      const input = screen.getByPlaceholderText('Search movies, series, anime…')
      fireEvent.change(input, { target: { value: 'matrix' } })

      await act(async () => {
        vi.advanceTimersByTime(250)
      })
      // Пропускаем ещё один тик, чтобы каскадный сброс ?page (эффект SearchDesktop,
      // реагирующий на уже применённый ?q) успел отработать и осесть в URL.
      await act(async () => {})

      expect(lastSearch).toContain('q=matrix')
      expect(lastSearch).not.toContain('page=3')
      expect(lastSearch).toContain('page=1')
    } finally {
      vi.useRealTimers()
    }
  })
})
