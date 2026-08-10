import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { useEffect } from 'react'
import { MemoryRouter, useLocation, useSearchParams } from 'react-router'

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

    expect(
      screen.getByText(/Ничего не найдено по «nonexistent-movie-xyz»/),
    ).toBeInTheDocument()
  })
})

describe('SearchMobile — устаревший/deep-linked ?page вне диапазона', () => {
  it('показывает MobilePagination рядом с EmptyState, чтобы вернуться на валидную страницу', async () => {
    // Курсор/страница закончились раньше запрошенной — movies: [], но totalPages всё ещё
    // приходит из total (см. getMoviesPage.ts / getSearchMovies.ts). EmptyState сам по себе
    // не даёт способа выбраться — единственный путь назад это MobilePagination.
    mockSearch([], { pages: 5, total: 50 })

    await renderSearchMobile(['/search?q=matrix&page=8'])

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

  it('не рендерит MobilePagination, когда результат пуст по-настоящему (totalPages: 0)', async () => {
    // Отдельный, нигде больше не встречающийся query — иначе in-memory кеш фетчера
    // (module-level Map в createCachedFetcher, ключ = {query, page}) вернул бы промис,
    // засвеченный другим тестом с теми же {query: 'nonexistent-movie-xyz', page: 1}.
    mockSearch([], { pages: 0, total: 0 })

    await renderSearchMobile(['/search?q=totally-empty-result-set-abc'])

    expect(
      screen.getByText(/Ничего не найдено по «totally-empty-result-set-abc»/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '1' })).not.toBeInTheDocument()
  })
})

describe('SearchMobile — MobilePagination и page-URL-sync', () => {
  it('page читается из ?page и передаётся в MobilePagination (активная кнопка страницы)', async () => {
    // Search-режим — page нативный (v1.5 `page`), в отличие от catalog-режима, где
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
      Array.from({ length: 10 }, (_, i) =>
        catalogDoc(`Catalog Movie ${i}`, 500 + i),
      ),
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
      Array.from({ length: 10 }, (_, i) =>
        catalogDoc(`Catalog Movie ${i}`, 600 + i),
      ),
      { total: 100 },
    )

    await renderSearchMobile(['/search?page=1'])

    // BottomSheet-содержимое (Filters/Sort) присутствует в DOM всегда (скрыто только CSS),
    // поэтому "последняя кнопка в документе" ненадёжна — сужаем поиск до контейнера
    // MobilePagination через соседний aria-live счётчик: [pagination-div, counter-div].
    const counter = screen.getByText(/shown · page/)
    const paginationContainer = counter.parentElement!
      .firstElementChild as HTMLElement
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
      Array.from({ length: 10 }, (_, i) =>
        catalogDoc(`Catalog Movie ${i}`, 700 + i),
      ),
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

describe('SearchMobile — появление ?q сбрасывает фильтры/sort (баг 2, мобильная шапка чипов и Sort-кнопка)', () => {
  // SearchMobile сам по себе не рендерит текстовый инпут поиска — на /search `MobileHeader`
  // показывает только кнопку-триггер "Search…", которая при уже открытом /search — no-op
  // навигация (см. Header.tsx: реальный debounce-инпут есть только в desktop-варианте
  // Header). Баг 2 живёт в usePageSync/useFilterState — они реагируют на *URL-переход* `?q`,
  // независимо от того, кто его записал. Этот хелпер пишет `?q`, не трогая остальные ключи,
  // — ровно так же, как это делает debounce-эффект в Header.tsx — чтобы воспроизвести
  // предпосылку бага без завязки на десктопный виджет.
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

  it('чипы и Sort-кнопка сбрасываются в дефолт, ?page сбрасывается на 1', async () => {
    mockCatalog([catalogDoc('Dune Part Two', 201)], { total: 50 })
    mockSearch([searchDoc('Matrix Revolutions', 101)])

    lastSearch = ''
    await act(async () => {
      render(
        <MemoryRouter
          initialEntries={['/search?genres=Drama&sort=Newest&page=3']}
        >
          <SearchMobile />
          <HeaderQuerySetter />
          <LocationProbe />
        </MemoryRouter>,
      )
    })

    expect(lastSearch).toContain('page=3')

    // Chips/Sort живут в стики-баре над результатами; тот же жанр-лейбл 'Drama' также
    // присутствует в BottomSheet-фильтрах (в DOM всегда, скрыт только CSS) — scoping через
    // родителя Sort-кнопки (сам стики-бар) исключает ложные совпадения с BottomSheet.
    const stickyBar = screen.getByRole('button', {
      name: /Sort/,
    }).parentElement!
    expect(within(stickyBar).getByText('Drama')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sort/ })).toHaveTextContent(
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

    expect(within(stickyBar).queryByText('Drama')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Sort/ })).toHaveTextContent(
      'Default',
    )
  })
})

describe('SearchMobile — ошибка фетчера (403/квота) достигает AsyncBoundary', () => {
  it('реджект от catalog-эндпоинта рендерит ErrorState вместо краша страницы', async () => {
    server.use(
      http.get(CATALOG_ENDPOINT, () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    )

    // rating=9 — параметр фильтра, не встречающийся в других тестах этого файла: fetcher-кеш
    // (module-level, переживает между тестами в файле) ключуется по параметрам запроса,
    // и переиспользование дефолтных/уже засвеченных фильтров здесь вернуло бы кешированный
    // успешный ответ из более раннего теста вместо реального обращения к этому 403-моку.
    await renderSearchMobile(['/search?rating=9'])

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Попробовать снова' }),
    ).toBeInTheDocument()
    // MobileHeader / BottomNav остаются — падает только контент внутри AsyncBoundary.
    expect(screen.getByRole('button', { name: /Filters/ })).toBeInTheDocument()
  })
})

describe('SearchMobile — индикатор загрузки (Task 7)', () => {
  it('в состоянии покоя обёртка результатов не помечена как busy и бейдж "Updating…" не рендерится', async () => {
    mockCatalog([catalogDoc('Oppenheimer', 301)])

    await renderSearchMobile(['/search?genres=Action'])

    const busyNode = document.querySelector('[aria-busy]')!
    expect(busyNode).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
  })

  it('после клика по пагинации индикатор в итоге пропадает, а данные новой страницы отображаются', async () => {
    // Уникальный query, не встречающийся в других тестах файла: fetcher-кеш (module-level Map
    // в createCachedFetcher, ключ = {query, page, ...}) иначе вернул бы cache-hit по {query:
    // 'matrix', page: 1}, засвеченному другим тестом с другим числом pages/total.
    mockSearch([searchDoc('Matrix Revolutions', 999)], { pages: 5, total: 50 })

    await renderSearchMobile(['/search?q=mobile-loading-indicator-test'])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    const busyNode = document.querySelector('[aria-busy]')!
    expect(busyNode).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
    expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument()
  })
})

describe('SearchMobile — переходное состояние индикатора при незавершённом запросе (Task 8)', () => {
  it('пока ответ на пагинацию не пришёл — старые данные остаются в DOM (не skeleton) и busy-индикатор виден; после резолва — новые данные, индикатор пропадает', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 901)], { pages: 5, total: 50 })

    await renderSearchMobile(['/search?q=transient-indicator-mobile'])

    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)

    // Начальный fetch (page 1) уже осел в кеше createCachedFetcher — переопределяем хендлер
    // на управляемый вручную промис, чтобы поймать состояние "запрос ушёл, ответа ещё нет"
    // для следующего (page 2) запроса, у которого другой cache-key.
    let resolvePending: (response: Response) => void = () => {}
    const pending = new Promise<Response>(resolve => {
      resolvePending = resolve
    })
    server.use(http.get(SEARCH_ENDPOINT, () => pending))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    // In-flight: useDeferredValue держит закоммиченным старый (page 1) рендер — use() внутри
    // useMovieCatalog берёт cache-hit на старых deferred-параметрах, а не саспенднутый новый
    // промис, поэтому старые данные видны как есть, а не Suspense-fallback/skeleton.
    expect(screen.getAllByText('Matrix Revolutions').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument()

    const busyNodeDuring = document.querySelector('[aria-busy]')!
    expect(busyNodeDuring).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Updating…')).toBeInTheDocument()

    resolvePending(
      HttpResponse.json({
        docs: [searchDoc('Interstellar Redux', 902)],
        total: 50,
        page: 2,
        pages: 5,
        limit: 10,
      }),
    )

    expect(await screen.findByText('Interstellar Redux')).toBeInTheDocument()
    expect(screen.queryAllByText('Matrix Revolutions')).toHaveLength(0)

    const busyNodeAfter = document.querySelector('[aria-busy]')!
    expect(busyNodeAfter).toHaveAttribute('aria-busy', 'false')
    expect(screen.queryByText('Updating…')).not.toBeInTheDocument()
    expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument()
  })
})

describe('SearchMobile — displayPage держит подсветку MobilePagination во время isUpdating (Task 7, ревью-фаза)', () => {
  it('пока идёт деферренный фетч новой страницы, активной подсвечена только что кликнутая (live) кнопка, а не старая', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 601)], { pages: 5, total: 50 })

    await renderSearchMobile(['/search?q=display-page-highlight-mobile'])

    let resolvePending: (response: Response) => void = () => {}
    const pending = new Promise<Response>(resolve => {
      resolvePending = resolve
    })
    server.use(http.get(SEARCH_ENDPOINT, () => pending))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    // In-flight: MobileSearchResults ещё рендерится от deferred (старых) параметров — но
    // MobilePagination обязан получать live `displayPage`, а не deferredPage, иначе клик
    // по "2" не подсвечивался бы до ответа сервера.
    const busyNode = document.querySelector('[aria-busy]')!
    expect(busyNode).toHaveAttribute('aria-busy', 'true')

    const activeBtn = screen.getByRole('button', { name: '2' })
    expect(activeBtn.style.background).toBe('rgba(209, 142, 95, 0.15)')

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
})

describe('SearchMobile — ошибка во время апдейта, не при монтировании (Task 8, ревью-фаза)', () => {
  it('фетч, зафейлившийся во время пагинации (isUpdating=true), не оставляет индикатор зависшим — рендерится ErrorState, aria-busy сбрасывается в false', async () => {
    mockSearch([searchDoc('Matrix Revolutions', 701)], { pages: 5, total: 50 })

    await renderSearchMobile(['/search?q=error-during-update-mobile'])

    let resolvePending: (response: Response) => void = () => {}
    const pending = new Promise<Response>(resolve => {
      resolvePending = resolve
    })
    server.use(http.get(SEARCH_ENDPOINT, () => pending))

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '2' }))
    })

    const busyNodeDuring = document.querySelector('[aria-busy]')!
    expect(busyNodeDuring).toHaveAttribute('aria-busy', 'true')
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
