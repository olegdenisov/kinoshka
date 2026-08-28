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

// Повторяет структуру src/app/router.tsx: AppLayout — layout-route с <Outlet/>, четыре дочерних
// роута — уже слитые страницы (Task 3-5 Favorites/Popular/Recommendations, Task 8 Home; здесь —
// плейсхолдеры вместо реальных компонентов, проверяем именно композицию chrome + Outlet, а не их
// бизнес-логику, которая уже покрыта Home.test.tsx/Favorites.test.tsx/Popular.test.tsx/
// Recommendations.test.tsx).
const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path='/' element={<div>Home page content</div>} />
          <Route
            path='/favorites'
            element={<div>Favorites page content</div>}
          />
          <Route path='/popular' element={<div>Popular page content</div>} />
          <Route
            path='/recommendations'
            element={<div>Recommendations page content</div>}
          />
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
})
