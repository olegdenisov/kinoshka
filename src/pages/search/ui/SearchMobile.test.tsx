import { useEffect } from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
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

describe('SearchMobile — устаревший/deep-linked ?page вне диапазона', () => {
  it('показывает MobilePagination рядом с EmptyState, чтобы вернуться на валидную страницу', async () => {
    // Курсор/страница закончились раньше запрошенной — movies: [], но totalPages всё ещё
    // приходит из total (см. getMoviesPage.ts / getSearchMovies.ts). EmptyState сам по себе
    // не даёт способа выбраться — единственный путь назад это MobilePagination.
    mockSearch([], { pages: 5, total: 50 })

    await renderSearchMobile(['/search?q=matrix&page=8'])

    expect(screen.getByText(/Ничего не найдено по «matrix»/)).toBeInTheDocument()

    const pageOneBtn = screen.getByRole('button', { name: '1' })
    expect(pageOneBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(pageOneBtn)
    })

    expect(lastSearch).toContain('page=1')
  })

  it('не рендерит MobilePagination, когда результат пуст по-настоящему (totalPages: 0)', async () => {
    // Отдельный, нигде больше не встречающийся query — иначе in-memory кеш фетчера
    // (module-level Map в createCachedFetcher, ключ = {query, page}) вернул бы промис,
    // засвеченный другим тестом с теми же {query: 'nonexistent-movie-xyz', page: 1}.
    mockSearch([], { pages: 0, total: 0 })

    await renderSearchMobile(['/search?q=totally-empty-result-set-abc'])

    expect(screen.getByText(/Ничего не найдено по «totally-empty-result-set-abc»/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
  })
})

describe('SearchMobile — MobilePagination и page-URL-sync', () => {
  it('page читается из ?page и передаётся в MobilePagination (активная кнопка страницы)', async () => {
    // Search-режим — page нативный (v1.4 `page`), в отличие от catalog-режима, где
    // страница эмулируется обходом курсора; не тянем сюда всю цепочку курсоров ради
    // одной проверки, что ?page реально доходит до MobilePagination.
    mockSearch([searchDoc('Matrix Revolutions', 401)], { pages: 5, total: 50 })

    await renderSearchMobile(['/search?q=matrix&page=3'])

    const activePageBtn = screen.getByRole('button', { name: '3' })
    expect(activePageBtn).toBeInTheDocument()
    expect(screen.getByText(/page 3 of 5/i)).toBeInTheDocument()
  })

  it('клик по номеру страницы пишет ?page в URL', async () => {
    mockCatalog(
      Array.from({ length: 10 }, (_, i) => catalogDoc(`Catalog Movie ${i}`, 500 + i)),
      { total: 100 },
    )

    await renderSearchMobile(['/search'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    expect(lastSearch).toContain('page=2')
  })

  it('клик по стрелке "вперёд" увеличивает ?page на 1', async () => {
    mockCatalog(
      Array.from({ length: 10 }, (_, i) => catalogDoc(`Catalog Movie ${i}`, 600 + i)),
      { total: 100 },
    )

    await renderSearchMobile(['/search?page=1'])

    // BottomSheet-содержимое (Filters/Sort) присутствует в DOM всегда (скрыто только CSS),
    // поэтому "последняя кнопка в документе" ненадёжна — сужаем поиск до контейнера
    // MobilePagination через соседний aria-live счётчик: [pagination-div, counter-div].
    const counter = screen.getByText(/shown · page/)
    const paginationContainer = counter.parentElement!.firstElementChild as HTMLElement
    const paginationButtons = within(paginationContainer).getAllByRole('button')
    const nextBtn = paginationButtons[paginationButtons.length - 1]
    expect(nextBtn).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(nextBtn)
    })

    expect(lastSearch).toContain('page=2')
  })

  it('смена фильтров сбрасывает ?page на 1', async () => {
    mockCatalog(
      Array.from({ length: 10 }, (_, i) => catalogDoc(`Catalog Movie ${i}`, 700 + i)),
      { total: 100 },
    )

    await renderSearchMobile(['/search?page=3&type=movie'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Series' }))
    })

    expect(lastSearch).toContain('page=1')
    expect(lastSearch).not.toContain('page=3')
  })
})

describe('SearchMobile — ошибка фетчера (403/квота) достигает AsyncBoundary', () => {
  it('реджект от catalog-эндпоинта рендерит ErrorState вместо краша страницы', async () => {
    server.use(
      http.get(CATALOG_ENDPOINT, () =>
        HttpResponse.json({ statusCode: 403, message: 'Forbidden', error: 'Forbidden' }, { status: 403 }),
      ),
    )

    // rating=9 — параметр фильтра, не встречающийся в других тестах этого файла: fetcher-кеш
    // (module-level, переживает между тестами в файле) ключуется по параметрам запроса,
    // и переиспользование дефолтных/уже засвеченных фильтров здесь вернуло бы кешированный
    // успешный ответ из более раннего теста вместо реального обращения к этому 403-моку.
    await renderSearchMobile(['/search?rating=9'])

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Попробовать снова' })).toBeInTheDocument()
    // MobileHeader / BottomNav остаются — падает только контент внутри AsyncBoundary.
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument()
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
