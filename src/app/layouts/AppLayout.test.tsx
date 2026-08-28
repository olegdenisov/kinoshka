import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { AppLayout } from './AppLayout'

// useViewport() читает window.innerWidth только один раз при монтировании (см.
// src/shared/lib/viewport/useViewport.ts) — задаём ширину до рендера, resize-событие
// диспатчить не нужно.
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 375

const setViewportWidth = (width: number) => {
  window.innerWidth = width
}

// Повторяет структуру src/app/router.tsx: AppLayout — layout-route с <Outlet/>, дочерние роуты —
// уже слитые страницы (Task 3-5 Favorites/Popular/Recommendations, Task 8 Home, Task 9 Movie,
// Task 10 Search; здесь — плейсхолдеры вместо реальных компонентов, проверяем именно композицию
// chrome + Outlet, а не их бизнес-логику, которая уже покрыта Home.test.tsx/Favorites.test.tsx/
// Popular.test.tsx/Recommendations.test.tsx/Movie.test.tsx/Search.test.tsx). `/search` — тоже
// плейсхолдер `<div>`, не реальный `Search`: `path` может включать query (`/search?type=series`),
// MemoryRouter матчит по pathname, query долетает до `AppLayout`'s `useSearchParams()` как есть.
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path='/' element={<div>Home page content</div>} />
          <Route path='/movie/:id' element={<div>Movie page content</div>} />
          <Route
            path='/favorites'
            element={<div>Favorites page content</div>}
          />
          <Route path='/popular' element={<div>Popular page content</div>} />
          <Route
            path='/recommendations'
            element={<div>Recommendations page content</div>}
          />
          <Route path='/search' element={<div>Search page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )

beforeEach(() => {
  setViewportWidth(DESKTOP_WIDTH)
})

afterEach(() => {
  // Header/MobileHeader оба рендерят ThemeToggle, который выставляет data-theme на
  // document.documentElement; jsdom document общий между тестами файла, сбрасываем, чтобы тема
  // не утекала в следующий тест (см. Header.test.tsx).
  document.documentElement.removeAttribute('data-theme')
})

describe('AppLayout — Outlet рендерит контент страницы независимо от chrome', () => {
  it('десктоп: контент /favorites рендерится рядом с Header', () => {
    renderAt('/favorites')
    expect(screen.getByText('Favorites page content')).toBeInTheDocument()
  })

  it('мобильный: контент /popular рендерится рядом с MobileHeader+BottomNav', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/popular')
    expect(screen.getByText('Popular page content')).toBeInTheDocument()
  })
})

// "Lists" — пункт, уникальный для BottomNav (у Header нет пункта с таким названием, только
// "Favorites"), поэтому его отсутствие однозначно доказывает, что BottomNav не смонтирован
// вовсе, а не просто скрыт CSS-ом (тот же приём, что Popular.test.tsx/Recommendations.test.tsx
// использовали до Task 6 для различения chrome-вариантов).
describe('AppLayout — десктоп рендерит Header, не MobileHeader/BottomNav', () => {
  it('/: activeNav="home" подсвечивает пункт "Home"', () => {
    renderAt('/')

    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('button', { name: 'Home' }).className,
    ).toMatch(/navPillActive/)
    expect(
      screen.queryByRole('button', { name: 'Lists' }),
    ).not.toBeInTheDocument()
  })

  it('/favorites: activeNav="favorites" подсвечивает пункт "Favorites"', () => {
    renderAt('/favorites')

    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('button', { name: 'Favorites' }).className,
    ).toMatch(/navPillActive/)
    expect(
      screen.queryByRole('button', { name: 'Lists' }),
    ).not.toBeInTheDocument()
  })

  it('/popular: activeNav="popular" подсвечивает пункт "Popular"', () => {
    renderAt('/popular')

    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('button', { name: 'Popular' }).className,
    ).toMatch(/navPillActive/)
    expect(
      screen.queryByRole('button', { name: 'Lists' }),
    ).not.toBeInTheDocument()
  })

  it('/recommendations: activeNav="recommendations" подсвечивает пункт "Picks"', () => {
    renderAt('/recommendations')

    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('button', { name: 'Picks' }).className,
    ).toMatch(/navPillActive/)
    expect(
      screen.queryByRole('button', { name: 'Lists' }),
    ).not.toBeInTheDocument()
  })

  // /movie/:id (Task 9) — MOVIE_CHROME не задаёт activeNav (см. докблок RouteChromeConfig в
  // AppLayout.tsx — воспроизводит поведение голого <Header /> из удалённого MovieDesktop.tsx),
  // поэтому ни один nav-pill не подсвечен.
  it('/movie/1: Header рендерится без подсвеченного nav-pill (activeNav не задан)', () => {
    renderAt('/movie/1')

    const banner = screen.getByRole('banner')
    expect(screen.getByText('Movie page content')).toBeInTheDocument()
    expect(
      within(banner)
        .getAllByRole('button')
        .some(btn => btn.className.match(/navPillActive/)),
    ).toBe(false)
  })
})

describe('AppLayout — мобильный рендерит MobileHeader+BottomNav, не Header', () => {
  it('/: MobileHeader без title показывает search-триггер (не логотип-заголовок), BottomNav — active="home"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/')

    // `/`-запись ROUTE_CHROME сознательно не задаёт `title` (см. докблок RouteChromeConfig.title
    // в AppLayout.tsx) — MobileHeader без title рендерит search-триггер вместо заголовка,
    // воспроизводя исходное поведение HomeMobile.tsx (`<MobileHeader />` без пропов).
    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Search…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Home/ }).className).toMatch(
      /navItemActive/,
    )
  })

  it('/favorites: MobileHeader получает title="Favorites", BottomNav — active="lists"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/favorites')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Favorites')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lists/ }).className).toMatch(
      /navItemActive/,
    )
    // Header (с pill-навигацией) не смонтирован вовсе — единственная "Favorites" на экране
    // это title MobileHeader, а не NavPill.
    expect(screen.queryAllByRole('button', { name: 'Favorites' })).toHaveLength(
      0,
    )
  })

  it('/popular: MobileHeader получает title="Popular", BottomNav — active="popular"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/popular')

    // "Popular" встречается и в title MobileHeader (div), и в подписи кнопки BottomNav —
    // сверяем title через within(banner), а активность кнопки — через getByRole отдельно.
    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Popular')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Popular/ }).className).toMatch(
      /navItemActive/,
    )
  })

  it('/recommendations: MobileHeader получает title="Recommended for you", BottomNav — active="recommendations"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/recommendations')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Recommended for you')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Picks/ }).className).toMatch(
      /navItemActive/,
    )
  })

  // /movie/:id (Task 9) — MOVIE_CHROME: onBack вместо логотипа, showSearch=false (нет
  // search-триггера), rightAction — кнопка "Share" (IconButton+ShareIcon), BottomNav —
  // active='search' (у detail-страницы фильма нет своего пункта, см. докблок MOVIE_CHROME).
  it('/movie/1: MobileHeader получает onBack/showSearch=false/rightAction="Share", BottomNav — active="search"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/movie/1')

    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByRole('button', { name: 'Share' }),
    ).toBeInTheDocument()
    expect(within(banner).queryByText('Search…')).not.toBeInTheDocument()
    // onBack рендерит кнопку "назад" (ChevronLeftIcon, без accessible name) вместо логотипа —
    // логотип ("kino·shka") больше не в дереве.
    expect(within(banner).queryByText('kino')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Catalog/ }).className).toMatch(
      /navItemActive/,
    )
  })
})

// /search (Task 10) — единственный роут, где Header's activeNav не выводится из pathname (один
// и тот же путь для любого ?type), а из useSearchParams().get('type') (см. SEARCH_CHROME/
// isSearchRoute в AppLayout.tsx). Реализация раньше жила в удалённом SearchDesktop.tsx
// (`activeNav={filters.type ?? 'search'}`) — тест "nav pill в шапке подсвечивается по ?type"
// переехал сюда вместе с этой логикой (было в SearchDesktop.test.tsx до слияния в единый Search).
describe('AppLayout — /search: Header.variant="search", activeNav из ?type (не из pathname)', () => {
  it('без ?type: инлайн-поиск виден, ни один type-pill не подсвечен', () => {
    renderAt('/search')

    const banner = screen.getByRole('banner')
    expect(
      within(banner).getByPlaceholderText('Search movies, series, anime…'),
    ).toBeInTheDocument()
    expect(
      within(banner)
        .getAllByRole('button')
        .some(btn => btn.className.match(/navPillActive/)),
    ).toBe(false)
  })

  it('/search?type=series подсвечивает "Series", соседние типы — нет (ревью-фикс: activeNav был захардкожен)', () => {
    renderAt('/search?type=series')

    const banner = screen.getByRole('banner')
    const seriesBtn = within(banner).getByRole('button', { name: 'Series' })
    expect(seriesBtn.className).toMatch(/navPillActive/)

    const moviesBtn = within(banner).getByRole('button', { name: 'Movies' })
    expect(moviesBtn.className).not.toMatch(/navPillActive/)

    const animeBtn = within(banner).getByRole('button', { name: 'Anime' })
    expect(animeBtn.className).not.toMatch(/navPillActive/)
  })

  it('мобильный /search: голый MobileHeader (search-триггер, без title), BottomNav — active="search"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/search')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Search…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Catalog/ }).className).toMatch(
      /navItemActive/,
    )
  })
})
