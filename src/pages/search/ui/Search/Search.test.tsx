import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { useEffect } from 'react'
import { MemoryRouter, useLocation, useSearchParams } from 'react-router'

import { server } from '../../../../test/setup'
import { Search } from './Search'

// Task 10 (план docs/plans/20260827-mobile-first-adaptive-layout.md) слила SearchDesktop.tsx/
// SearchMobile.tsx в единый адаптивный Search — useViewport() внутри самого компонента
// (не на уровне *Page.tsx) решает, какой вариант фильтров/сортировки монтируется. jsdom не
// считает media queries (см. Testing Strategy плана), но isMobile здесь — обычная JS-развилка
// (условный рендер, не CSS), поэтому смена window.innerWidth действительно переключает, какое
// поддерево оказывается в DOM — тот же приём, что AppLayout.test.tsx использует для Header vs
// MobileHeader+BottomNav.
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 375

const setViewportWidth = (width: number) => {
  window.innerWidth = width
}

/** Читает текущую строку query из роутера — способ проверить, что запись в URL реально произошла. */
let lastSearch = ''
const LocationProbe = () => {
  const { search } = useLocation()
  useEffect(() => {
    lastSearch = search
  }, [search])
  return null
}

// Search больше не рендерит Header сама (chrome — забота AppLayout, см. router.tsx/AppLayout.tsx)
// — тесты, которым раньше был нужен реальный десктопный Header (debounce-запись ?q при вводе в
// поисковый инпут), воспроизводят тот же URL-переход этим хелпером вместо рендера Header целиком.
// Тот же приём уже использовался в удалённом SearchMobile.test.tsx (там Header тоже не был частью
// SearchMobile) — теперь применяется единообразно для обоих брейкпоинтов, раз оба читают ?q из
// одного и того же useSearchParams().
const HeaderQuerySetter = () => {
  const [, setSearchParams] = useSearchParams()
  return (
    <button
      type='button'
      onClick={() =>
        setSearchParams(
          prev => {
            const params = new URLSearchParams(prev)
            params.set('q', 'matrix')
            return params
          },
          { replace: true },
        )
      }
    >
      simulate header q write
    </button>
  )
}

const SEARCH_ENDPOINT = '*/v1.5/movie/search'
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

const mockSearch = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  server.use(
    http.get(SEARCH_ENDPOINT, () =>
      HttpResponse.json({
        docs,
        total: docs.length,
        page: 1,
        pages: 1,
        limit: 10,
        ...overrides,
      }),
    ),
  )
}

const mockCatalog = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
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

const renderSearch = async (
  initialEntries: string[],
  extra?: React.ReactNode,
) => {
  lastSearch = ''
  let result: ReturnType<typeof render> | undefined
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={initialEntries}>
        <Search />
        {extra}
        <LocationProbe />
      </MemoryRouter>,
    )
  })
  return result!
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  setViewportWidth(DESKTOP_WIDTH)
})

// Search рендерит GenreSelector, которая фонит (fire-and-forget) фоновый useGenreDictionary()
// рефреш на монтировании — без ожидания он может резолвиться уже после конца теста и писать в
// localStorage/module state (см. тот же приём в GenreSelector.test.tsx/useGenreDictionary.test.tsx).
afterEach(async () => {
  await new Promise(resolve => setTimeout(resolve, 0))
})

describe('Search (desktop-ветка) — режим search (?q задан)', () => {
  it('рендерит грид из search-эндпоинта и дизейблит сайдбар фильтров/сортировку', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)])
    mockCatalog([catalogDoc('Should Not Appear', 102)])

    await renderSearch(['/search?q=matrix-revolutions'])

    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)

    // SearchSidebar задизейблена целиком (Variant A: query и фильтры не сочетаются) —
    // проверяем не только Type-радиокнопки, но и остальные интерактивные контролы сайдбара
    // (Genre-чипы, Rating-кнопки, Reset), чтобы поломка проброса disabled на любую из них
    // не проходила незамеченной.
    const sidebar = document.querySelector('aside')!
    const typeButtons = within(sidebar).getAllByRole('button', {
      name: /Movies|Series|Anime/,
    })
    typeButtons.forEach(btn => expect(btn).toBeDisabled())

    const genreButtons = within(sidebar).getAllByRole('button', {
      name: /Action|Drama|Sci-Fi/,
    })
    genreButtons.forEach(btn => expect(btn).toBeDisabled())

    const ratingButtons = within(sidebar).getAllByRole('button', {
      name: /^\d\+$/,
    })
    expect(ratingButtons.length).toBeGreaterThan(0)
    ratingButtons.forEach(btn => expect(btn).toBeDisabled())

    expect(
      within(sidebar).getByRole('button', { name: 'Reset filters' }),
    ).toBeDisabled()

    // Сортировка тоже задизейблена в search-режиме (Variant A) — sortDisabled=isSearchMode,
    // проброшенный Search → SearchControls → SortSelect.
    expect(screen.getByRole('button', { name: /^Sort/ })).toBeDisabled()
  })
})

describe('Search (desktop-ветка) — режим catalog (без ?q, есть фильтры)', () => {
  it('рендерит грид из catalog-эндпоинта, сайдбар активен', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)])
    mockSearch([searchDoc('Should Not Appear', 202)])

    await renderSearch(['/search?genres=Drama'])

    expect(screen.getAllByText('Dune Part Two').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)

    const sidebar = document.querySelector('aside')!
    const typeButtons = within(sidebar).getAllByRole('button', {
      name: /Movies|Series|Anime/,
    })
    typeButtons.forEach(btn => expect(btn).not.toBeDisabled())

    expect(
      within(sidebar).getByRole('button', { name: 'Reset filters' }),
    ).not.toBeDisabled()

    // Сортировка активна вне search-режима.
    expect(screen.getByRole('button', { name: /^Sort/ })).not.toBeDisabled()
  })
})

describe('Search — ошибка фетчера (403/квота) достигает AsyncBoundary', () => {
  it('реджект от search-эндпоинта рендерит ErrorState вместо краша страницы, сайдбар/заголовок остаются (падает только контент AsyncBoundary)', async () => {
    server.use(
      http.get(SEARCH_ENDPOINT, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )

    await renderSearch(['/search?q=quota-exceeded-probe'])

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Попробовать снова' }),
    ).toBeInTheDocument()
    // Search-owned chrome (не Header — тот теперь только в AppLayout, не рендерится Search
    // изолированно в этом тесте) остаётся на месте: сайдбар и заголовок страницы никуда не делись.
    expect(document.querySelector('aside')).toBeInTheDocument()
    expect(
      screen.getByText('Results for “quota-exceeded-probe”'),
    ).toBeInTheDocument()
  })
})

describe('Search — Retry реально уходит в сеть (roadmap 1.6)', () => {
  it('search-режим: ошибка → клик Retry → новый MSW-запрос (не тот же rejected-промис), рендерятся данные', async () => {
    let requests = 0
    server.use(
      http.get(SEARCH_ENDPOINT, () => {
        requests += 1
        return HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        )
      }),
    )

    await renderSearch(['/search?q=retry-search-probe'])

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(requests).toBe(1)

    server.use(
      http.get(SEARCH_ENDPOINT, () => {
        requests += 1
        return HttpResponse.json({
          docs: [searchDoc('Recovered After Retry', 901)],
          total: 1,
          page: 1,
          pages: 1,
          limit: 10,
        })
      }),
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    })

    expect(requests).toBe(2)
    expect(await screen.findByText('Recovered After Retry')).toBeInTheDocument()
  })

  it('catalog-режим: ошибка → клик Retry → новый MSW-запрос, рендерятся данные', async () => {
    let requests = 0
    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        requests += 1
        return HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        )
      }),
    )

    await renderSearch(['/search?genres=Drama&rating=6'])

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(requests).toBe(1)

    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        requests += 1
        return HttpResponse.json({
          docs: [catalogDoc('Recovered Catalog Movie', 902)],
          limit: 10,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 1,
        })
      }),
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    })

    expect(requests).toBe(2)
    expect(
      await screen.findByText('Recovered Catalog Movie'),
    ).toBeInTheDocument()
  })
})

describe('Search — пустой результат', () => {
  it('показывает EmptyState с эхом запроса', async () => {
    mockSearch([])

    await renderSearch(['/search?q=nonexistent-movie-xyz'])

    expect(
      screen.getByText(/Ничего не найдено по «nonexistent-movie-xyz»/),
    ).toBeInTheDocument()
  })
})

describe('Search — устаревший/deep-linked ?page вне диапазона', () => {
  it('показывает Pagination рядом с EmptyState, чтобы вернуться на валидную страницу', async () => {
    mockSearch([], { pages: 5, total: 50 })

    await renderSearch(['/search?q=matrix&page=8'])

    expect(
      screen.getByText(/Ничего не найдено по «matrix»/),
    ).toBeInTheDocument()

    const pageOneBtn = screen.getByRole('button', { name: '1' })
    expect(pageOneBtn).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(pageOneBtn)
    })

    expect(lastSearch).toContain('page=1')
  })

  it('не рендерит Pagination, когда результат пуст по-настоящему (totalPages: 0)', async () => {
    mockSearch([], { pages: 0, total: 0 })

    await renderSearch(['/search?q=totally-empty-result-set-abc'])

    expect(
      screen.getByText(/Ничего не найдено по «totally-empty-result-set-abc»/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
  })
})

describe('Search — индикатор загрузки', () => {
  it('в состоянии покоя обёртка результатов не помечена как busy и бейдж "Updating…" не рендерится', async () => {
    mockCatalog([catalogDoc('Oppenheimer', 301)])

    await renderSearch(['/search?genres=Action'])

    const busyNode = document.querySelector('[aria-busy]')!
    expect(busyNode).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
  })

  it('пока ответ на пагинацию не пришёл — старые данные остаются в DOM и busy-индикатор виден; после резолва — новые данные, индикатор пропадает', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 501)], { pages: 5, total: 50 })

    await renderSearch(['/search?q=transient-indicator'])

    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)

    let resolvePending: (response: Response) => void = () => {}
    const pending = new Promise<Response>(resolve => {
      resolvePending = resolve
    })
    server.use(http.get(SEARCH_ENDPOINT, () => pending))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)
    const busyNodeDuring = document.querySelector('[aria-busy]')!
    expect(busyNodeDuring).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Updating…')).toBeInTheDocument()

    resolvePending(
      HttpResponse.json({
        docs: [searchDoc('Interstellar Redux', 502)],
        total: 50,
        page: 2,
        pages: 5,
        limit: 10,
      }),
    )

    expect(
      (await screen.findAllByText('Interstellar Redux')).length,
    ).toBeGreaterThan(0)
    expect(screen.queryAllByText('Matrix Revolutions')).toHaveLength(0)

    const busyNodeAfter = document.querySelector('[aria-busy]')!
    expect(busyNodeAfter).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument()
  })

  it('displayPage держит подсветку Pagination во время isUpdating (не deferredPage)', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 601)], { pages: 5, total: 50 })

    await renderSearch(['/search?q=display-page-highlight'])

    let resolvePending: (response: Response) => void = () => {}
    const pending = new Promise<Response>(resolve => {
      resolvePending = resolve
    })
    server.use(http.get(SEARCH_ENDPOINT, () => pending))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    const activeBtn = screen.getByRole('button', { name: '2' })
    expect(activeBtn.className).toMatch(/btnActive/)

    resolvePending(
      HttpResponse.json({
        docs: [searchDoc('Interstellar Redux', 602)],
        total: 50,
        page: 2,
        pages: 5,
        limit: 10,
      }),
    )

    expect(await screen.findByText(/page 2 of 5/i)).toBeInTheDocument()
  })

  it('ошибка во время апдейта (не при монтировании) не оставляет индикатор зависшим', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 701)], { pages: 5, total: 50 })

    await renderSearch(['/search?q=error-during-update'])

    let resolvePending: (response: Response) => void = () => {}
    const pending = new Promise<Response>(resolve => {
      resolvePending = resolve
    })
    server.use(http.get(SEARCH_ENDPOINT, () => pending))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    expect(screen.getByText('Updating…')).toBeInTheDocument()

    await act(async () => {
      resolvePending(
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        ),
      )
    })

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    const busyNodeAfter = document.querySelector('[aria-busy]')!
    expect(busyNodeAfter).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
  })
})

describe('Search — синхронизация типа из hero-навигации (browse-режим, ?type без ?q)', () => {
  it('деплинк на /search?type=movie подсвечивает "Movies" в сайдбаре, соседние типы не активны', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)])

    await renderSearch(['/search?type=movie'])

    const sidebar = document.querySelector('aside')!

    const moviesBtn = within(sidebar).getByRole('button', { name: /^Movies/ })
    expect(moviesBtn.className).toMatch(/radioRowActive/)

    const seriesBtn = within(sidebar).getByRole('button', { name: /^Series/ })
    expect(seriesBtn.className).not.toMatch(/radioRowActive/)
  })
})

describe('Search — a11y счётчика результатов', () => {
  it('счётчик результатов помечен aria-live="polite"', async () => {
    mockCatalog([catalogDoc('Oppenheimer', 301)])

    const { container } = await renderSearch(['/search?genres=Action'])

    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeInTheDocument()
    expect(liveRegion).toHaveTextContent(/page 1 of/i)
  })
})

describe('Search — пагинация: page читается из ?page', () => {
  it('page из URL прокидывается в фетчер и отображается в счётчике', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)], { pages: 5, total: 50 })

    await renderSearch(['/search?q=matrix&page=3'])

    expect(screen.getByText(/page 3 of 5/i)).toBeInTheDocument()
  })

  it('клэмпит page из URL к демо-потолку 10', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)], {
      pages: 10,
      total: 100,
    })

    await renderSearch(['/search?q=matrix&page=999'])

    expect(screen.getByText(/page 10 of 10/i)).toBeInTheDocument()
  })
})

describe('Search — пагинация: клик пишет ?page', () => {
  it('клик по номеру страницы пишет ?page (replace)', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 101)], { pages: 5, total: 50 })

    await renderSearch(['/search?q=matrix'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    expect(lastSearch).toContain('page=2')
  })
})

describe('Search — YearRangeSlider в сайдбаре', () => {
  it('перетаскивание назад к полному диапазону очищает ?yearFrom/?yearTo из URL', async () => {
    mockCatalog([catalogDoc('Oppenheimer', 305)])

    await renderSearch(['/search?yearFrom=1990&yearTo=2010'])

    const fromInput = screen.getByRole('slider', { name: 'Year from' })
    const toInput = screen.getByRole('slider', { name: 'Year to' })

    await act(async () => {
      fireEvent.change(fromInput, { target: { value: '1900' } })
      fireEvent.mouseUp(fromInput)
    })
    expect(lastSearch).toContain('yearFrom=1900')

    await act(async () => {
      fireEvent.change(toInput, {
        target: { value: String(new Date().getFullYear()) },
      })
      fireEvent.mouseUp(toInput)
    })

    expect(lastSearch).not.toContain('yearFrom=')
    expect(lastSearch).not.toContain('yearTo=')
  })
})

describe('Search — пагинация: сброс ?page на 1 при смене фильтров/?q', () => {
  it('смена фильтра (клик по сайдбару) сбрасывает ?page на 1', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)], { total: 50 })

    await renderSearch(['/search?genres=Drama&page=3'])
    expect(lastSearch).toContain('page=3')

    const sidebar = document.querySelector('aside')!
    const moviesBtn = within(sidebar).getByRole('button', { name: /^Movies/ })

    await act(async () => {
      fireEvent.click(moviesBtn)
    })

    expect(lastSearch).toContain('page=1')
    expect(lastSearch).not.toContain('page=3')
  })

  // Search больше не рендерит Header (chrome — AppLayout, см. router.tsx), а debounce-запись ?q
  // при вводе в поисковый инпут — логика самого Header, не Search. usePageSync/useFilterState
  // (баг 2, не трогается этой задачей) реагируют на *URL-переход* ?q независимо от того, кто его
  // записал — HeaderQuerySetter выше воспроизводит ровно то, что делает Header.tsx's debounce-
  // эффект, без рендера Header целиком (тот же приём уже использовался в удалённом
  // SearchMobile.test.tsx, теперь — единообразно для обеих веток).
  it('появление ?q сбрасывает ?page на 1 и зачищает фильтры/sort', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)], { total: 50 })
    mockSearch([searchDoc('Matrix Revolutions', 101)])

    await renderSearch(
      ['/search?genres=Drama&sort=Newest&page=3'],
      <HeaderQuerySetter />,
    )
    expect(lastSearch).toContain('page=3')

    const main = document.querySelector('main')!
    expect(within(main).getByText('Drama')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sort/ })).toHaveTextContent(
      'Newest',
    )

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'simulate header q write' }),
      )
    })

    expect(lastSearch).toContain('q=matrix')
    expect(lastSearch).not.toContain('page=3')
    expect(lastSearch).toContain('page=1')
    expect(lastSearch).not.toContain('genres=')
    expect(lastSearch).not.toContain('sort=')

    expect(within(main).queryByText('Drama')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Sort/ })).toHaveTextContent(
      'Default',
    )
  })
})

// ---------------------------------------------------------------------------------------------
// Мобильная ветка (isMobile=true) — покрывает только то, что реально отличается от десктопной
// ветки выше: sidebar/SearchControls заменяются filter-bar-триггерами + BottomSheet, сортировка —
// дропдаун заменяется bottom-sheet-списком (см. Search.tsx докблок про sidebar vs bottom-sheet и
// dropdown vs bottom-sheet как два разных UX-паттерна, не CSS-варианта). Данные/пагинация/retry/
// индикатор загрузки — тот же код (SearchResults, общий для обеих веток), уже полностью покрыт
// десктопной секцией выше — не дублируется здесь ради дублирования.
// ---------------------------------------------------------------------------------------------

describe('Search (mobile-ветка) — режимы search/catalog', () => {
  it('рендерит результаты из search-эндпоинта в режиме search, дизейблит триггеры Filters/Sort', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockSearch([searchDoc('Matrix Revolutions', 111)])
    mockCatalog([catalogDoc('Should Not Appear', 112)])

    await renderSearch(['/search?q=matrix'])

    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Filters/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Sort/ })).toBeDisabled()
  })

  it('рендерит результаты из catalog-эндпоинта в режиме catalog, триггеры активны', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockCatalog([catalogDoc('Dune Part Two', 201)])
    mockSearch([searchDoc('Should Not Appear', 202)])

    await renderSearch(['/search?genres=Drama'])

    expect(screen.getAllByText('Dune Part Two').length).toBeGreaterThan(0)
    expect(screen.queryAllByText('Should Not Appear')).toHaveLength(0)
    expect(screen.getByRole('button', { name: /Filters/ })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: /Sort/ })).not.toBeDisabled()
  })
})

describe('Search (mobile-ветка) — ошибка фетчера достигает AsyncBoundary', () => {
  it('реджект рендерит ErrorState, filter-bar триггеры остаются (падает только контент AsyncBoundary)', async () => {
    setViewportWidth(MOBILE_WIDTH)
    server.use(
      http.get(CATALOG_ENDPOINT, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )

    await renderSearch(['/search?rating=9'])

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument()
  })
})

describe('Search (mobile-ветка) — BottomSheet фильтров пишет в URL', () => {
  it('выбор типа в BottomSheet фильтров пишет ?type в URL (replace) и сбрасывает ?page', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockCatalog([catalogDoc('Oppenheimer', 301)])

    await renderSearch(['/search?page=3'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Movies' }))
    })

    expect(lastSearch).toContain('type=movie')
    expect(lastSearch).toContain('page=1')
  })

  it('YearRangeSlider в BottomSheet: значения читаются из ?yearFrom/?yearTo, коммит drag пишет их обратно', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockCatalog([catalogDoc('Oppenheimer', 303)])

    await renderSearch(['/search?yearFrom=1990&yearTo=2010'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    })

    const fromInput = screen.getByRole('slider', { name: 'Year from' })
    expect(fromInput).toHaveValue('1990')
    expect(screen.getByRole('slider', { name: 'Year to' })).toHaveValue('2010')

    await act(async () => {
      fireEvent.change(fromInput, { target: { value: '1995' } })
      fireEvent.mouseUp(fromInput)
    })

    expect(lastSearch).toContain('yearFrom=1995')
  })
})

describe('Search (mobile-ветка) — BottomSheet сортировки пишет ?sort', () => {
  it('выбор сортировки закрывает bottom-sheet и пишет ?sort в URL', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockCatalog([catalogDoc('Interstellar', 302)])

    await renderSearch(['/search'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Sort/ }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Newest/ }))
    })

    expect(lastSearch).toContain('sort=Newest')
  })
})

describe('Search (mobile-ветка) — футер BottomSheet фильтров (Reset/Show results)', () => {
  it('Reset очищает активные фильтры, не закрывая bottom-sheet', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockCatalog([catalogDoc('Oppenheimer', 304)])

    await renderSearch(['/search?genres=Drama&rating=8'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    })

    // Rating-кнопка "8+" активна до сброса — тот же фильтр, что задан в URL выше.
    expect(screen.getByRole('button', { name: '8+' }).className).toMatch(
      /ratingBtnActive/,
    )

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    })

    expect(lastSearch).not.toContain('genres=')
    expect(lastSearch).not.toContain('rating=')
    // Bottom-sheet остаётся открытым — Reset не совпадает по семантике с закрытием
    // (`BottomSheet` всегда рендерит children, открытость — CSS-класс на backdrop/sheet).
    expect(screen.getByRole('button', { name: '8+' }).className).not.toMatch(
      /ratingBtnActive/,
    )
    expect(
      screen.getAllByRole('button', { name: 'Close' })[0].className,
    ).toMatch(/backdropOpen/)
  })

  it('Show results закрывает bottom-sheet (backdrop теряет open-класс), не трогая уже применённые фильтры', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockCatalog([catalogDoc('Oppenheimer', 306)])

    await renderSearch(['/search?genres=Drama'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Filters/ }))
    })
    // Первый `BottomSheet` в дереве — фильтры (см. Search.tsx: фильтры рендерятся раньше сортировки).
    const filterBackdrop = () =>
      screen.getAllByRole('button', { name: 'Close' })[0]
    expect(filterBackdrop().className).toMatch(/backdropOpen/)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
    })

    expect(filterBackdrop().className).not.toMatch(/backdropOpen/)
    // Фильтр остаётся применённым — Show results закрывает лист, не сбрасывая выбор.
    expect(lastSearch).toContain('genres=Drama')
  })
})

describe('Search (mobile-ветка) — избранное в гриде результатов', () => {
  it('клик по сердечку карточки пишет id фильма в localStorage', async () => {
    setViewportWidth(MOBILE_WIDTH)
    mockCatalog([catalogDoc('Oppenheimer', 801)])
    const user = userEvent.setup()

    await renderSearch(['/search?rating=8'])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[801]')
  })
})
