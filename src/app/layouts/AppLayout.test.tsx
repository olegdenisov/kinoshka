import { urlAtom } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { matchRoutePattern } from '@shared/config'
import type * as SharedLib from '@shared/lib'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'

import { renderWithRouter } from '../../test/router'
import { AppLayout } from './AppLayout'

// Task 5 (docs/plans/20260910-web-vitals-analytics.md): AppLayout вызывает trackPageview() на
// смену pathname. Мокаем только trackPageview, остальные реальные экспорты (useViewport и т.д.,
// которые AppLayout уже использует) сохраняем через vi.importActual — тот же паттерн, что
// providers.test.tsx использует для initAnalytics (reportWebVitals с тех пор удалён вместе с
// пайплайном Web Vitals→Plausible, см. план 20260915-telemetry-dashboard-sentry-alerts.md, Task 5
// — providers.test.tsx больше не мокает и не проверяет его).
vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackPageview: vi.fn() }
})

const { trackPageview } = await import('@shared/lib')

// Per-route ErrorBoundary (роадмап 2.6) репортит через captureRouteError — мокаем целиком, чтобы
// не тянуть реальный @sentry/react и проверять сам факт вызова (тот же приём, что с trackPageview).
vi.mock('../sentry', () => ({ captureRouteError: vi.fn() }))

const { captureRouteError } = await import('../sentry')

// useViewport() читает window.innerWidth только один раз при монтировании (см.
// src/shared/lib/viewport/useViewport.ts) — задаём ширину до рендера, resize-событие
// диспатчить не нужно.
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 375

const setViewportWidth = (width: number) => {
  window.innerWidth = width
}

// AppLayout получает страницу через children (в проде — outlet layout-роута, routes.tsx). Здесь
// вместо реальных страниц — плейсхолдер по шаблону текущего пути: проверяем композицию chrome +
// контент, а не бизнес-логику страниц (у них свои тесты).
const PAGE_TEXT: Record<string, string> = {
  '/': 'Home page content',
  '/movie/:id': 'Movie page content',
  '/favorites': 'Favorites page content',
  '/watched': 'Watched page content',
  '/watchlist': 'Watchlist page content',
  '/popular': 'Popular page content',
  '/recommendations': 'Recommendations page content',
  '/search': 'Search page content',
  '/profile': 'Profile page content',
  '/person/:id': 'Person page content',
}

const PagePlaceholder = reatomComponent(() => {
  const pattern = matchRoutePattern(urlAtom().pathname)
  return <div>{pattern ? PAGE_TEXT[pattern] : 'Unknown page content'}</div>
}, 'PagePlaceholder')

const renderAt = (path: string) =>
  renderWithRouter(
    <AppLayout>
      <PagePlaceholder />
    </AppLayout>,
    { url: path },
  )

const navigateTo = (path: string) => act(async () => urlAtom.go(path))

beforeEach(() => {
  vi.mocked(trackPageview).mockClear()
  vi.mocked(captureRouteError).mockClear()
  setViewportWidth(DESKTOP_WIDTH)
})

afterEach(() => {
  // Header/MobileHeader оба рендерят ThemeToggle, который выставляет data-theme на
  // document.documentElement; jsdom document общий между тестами файла, сбрасываем, чтобы тема
  // не утекала в следующий тест (см. Header.test.tsx).
  document.documentElement.removeAttribute('data-theme')
})

describe('AppLayout — children рендерит контент страницы независимо от chrome', () => {
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

  it('/watchlist: Header без подсвеченного nav-pill, BottomNav не рендерится', () => {
    renderAt('/watchlist')

    const banner = screen.getByRole('banner')
    expect(screen.getByText('Watchlist page content')).toBeInTheDocument()
    expect(
      within(banner)
        .getAllByRole('button')
        .some(btn => btn.className.match(/navPillActive/)),
    ).toBe(false)
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

  // /profile — ROUTE_CHROME['/profile'] не задаёт activeNav (у Header нет nav-pill профиля),
  // поэтому ни один nav-pill не подсвечен; вместо него — аватар-ссылка на /profile.
  it('/profile: Header рендерится без подсвеченного nav-pill (activeNav не задан)', () => {
    renderAt('/profile')

    const banner = screen.getByRole('banner')
    expect(screen.getByText('Profile page content')).toBeInTheDocument()
    expect(
      within(banner)
        .getAllByRole('button')
        .some(btn => btn.className.match(/navPillActive/)),
    ).toBe(false)
    expect(
      within(banner).getByRole('link', { name: 'Your profile' }),
    ).toHaveAttribute('href', '/profile')
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

  // /person/:id (Task 10) — PERSON_CHROME не задаёт activeNav (та же логика, что MOVIE_CHROME),
  // поэтому ни один nav-pill не подсвечен. `variant='default'` (не 'search') доказывается тем же
  // маркером, что и в isSearchRoute-тестах ниже: инлайн-поиск (плейсхолдер "Search movies, series,
  // anime…") не рендерится — обычный `<Header/>` с логотипом и nav-pill'ами.
  it('/person/1: Header рендерится без подсвеченного nav-pill, variant="default" (не "search")', () => {
    renderAt('/person/1')

    const banner = screen.getByRole('banner')
    expect(screen.getByText('Person page content')).toBeInTheDocument()
    expect(
      within(banner)
        .getAllByRole('button')
        .some(btn => btn.className.match(/navPillActive/)),
    ).toBe(false)
    expect(
      within(banner).queryByPlaceholderText('Search movies, series, anime…'),
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

  it('/watched: MobileHeader получает title="Watched", BottomNav — active="lists"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/watched')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Watched')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lists/ }).className).toMatch(
      /navItemActive/,
    )
  })

  it('/watchlist: MobileHeader получает title="Watchlist", BottomNav — active="lists"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/watchlist')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Watchlist')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lists/ }).className).toMatch(
      /navItemActive/,
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

  it('/profile: MobileHeader получает title="Profile", BottomNav — active="profile"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/profile')

    const banner = screen.getByRole('banner')
    expect(within(banner).getByText('Profile')).toBeInTheDocument()
    // десктопный Header не смонтирован — его nav-pill'ов нет
    expect(
      within(banner).queryByRole('button', { name: 'Popular' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Profile/ }).className).toMatch(
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

  // /person/:id (Task 10) — PERSON_CHROME: onBack вместо логотипа, showSearch=false (нет
  // search-триггера), без rightAction (в отличие от MOVIE_CHROME — см. докблок PERSON_CHROME в
  // AppLayout.tsx), BottomNav — active='search' (у detail-страницы персоны нет своего пункта).
  it('/person/1: MobileHeader получает onBack/showSearch=false, без rightAction, BottomNav — active="search"', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/person/1')

    const banner = screen.getByRole('banner')
    expect(within(banner).queryByText('Search…')).not.toBeInTheDocument()
    // onBack рендерит кнопку "назад" вместо логотипа — логотип не в дереве.
    expect(within(banner).queryByText('kino')).not.toBeInTheDocument()
    // Нет rightAction — в отличие от /movie/:id, здесь нет кнопки "Share".
    expect(
      within(banner).queryByRole('button', { name: 'Share' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Catalog/ }).className).toMatch(
      /navItemActive/,
    )
  })
})

// Неизвестный путь (страница NotFound в routes.tsx) получает chrome главной.
describe('AppLayout — неизвестный путь: chrome главной', () => {
  it('десктоп: Header с подсвеченным "Home"', () => {
    renderAt('/no-such-page')

    expect(screen.getByText('Unknown page content')).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Home' })
        .className,
    ).toMatch(/navPillActive/)
  })

  it('мобильный: MobileHeader с search-триггером и BottomNav', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderAt('/no-such-page')

    expect(
      within(screen.getByRole('banner')).getByText('Search…'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Home/ }).className).toMatch(
      /navItemActive/,
    )
  })
})

// /search (Task 10) — единственный роут, где Header's activeNav не выводится из pathname (один
// и тот же путь для любого ?type), а из filters().type (см. SEARCH_CHROME/
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

// Task 5 (docs/plans/20260910-web-vitals-analytics.md): trackPageview() реагирует на смену
// pathname, не на смену query-параметров. Дерево монтируется один раз и дальше навигируется
// через urlAtom.go — два отдельных рендера не различили бы смену pathname и смену query.
describe('AppLayout — page view tracking: смена pathname трекается, смена только query — нет', () => {
  it('маунт на /: 1 вызов; navigate на /favorites: ещё вызов; navigate на /favorites?x=1: без нового вызова', async () => {
    renderAt('/')

    await waitFor(() => expect(trackPageview).toHaveBeenCalledTimes(1))

    await navigateTo('/favorites')
    await waitFor(() => expect(trackPageview).toHaveBeenCalledTimes(2))
    expect(screen.getByText('Favorites page content')).toBeInTheDocument()

    await navigateTo('/favorites?x=1')
    // Тот же pathname, сменился только query — trackPageview не должен вызваться повторно.
    expect(urlAtom().search).toBe('?x=1')
    expect(trackPageview).toHaveBeenCalledTimes(2)

    // Динамический сегмент тоже меняет pathname — trackPageview вызывается ещё раз.
    await navigateTo('/person/1')
    await waitFor(() => expect(trackPageview).toHaveBeenCalledTimes(3))
    expect(screen.getByText('Person page content')).toBeInTheDocument()
  })
})

// Per-route ErrorBoundary (роадмап 2.6, docs/plans/20260916-per-route-error-boundaries.md).
// module-level флаг (не self-flipping внутри рендера) — React после ошибки в рендере синхронно
// повторяет рендер ещё раз ДО того, как считать её настоящей ошибкой (см. ErrorBoundary.test.tsx).
let shouldThrow = true
// Фиксированный текст фолбэка per-route границы — сырое error.message пользователю не показываем.
const ROUTE_FALLBACK_TEXT = 'An unexpected error occurred. Please try again.'
const Bomb = () => {
  if (shouldThrow) throw new Error('boom')
  return <div>Recovered page content</div>
}

// Счётчик маунтов для проверки ремаунта на key={pathname} внутри одного динамического роута.
let personMounts = 0
const PersonPlaceholder = () => {
  useEffect(() => {
    personMounts += 1
  }, [])
  return <div>Person page content</div>
}

// Бомба стоит на /popular (а не на отдельном /broken), чтобы у роута был ROUTE_CHROME-конфиг и на
// мобильном рендерился BottomNav — иначе проверка «chrome цел» на мобильном была бы пустой.
type ErrorPagesProps = {
  home: ReactNode
}

const ErrorPages = reatomComponent(({ home }: ErrorPagesProps) => {
  switch (matchRoutePattern(urlAtom().pathname)) {
    case '/':
      return home
    case '/popular':
      return <Bomb />
    case '/person/:id':
      return <PersonPlaceholder />
    default:
      return null
  }
}, 'ErrorPages')

const renderErrorApp = (
  initialPath: string,
  home: ReactNode = <div>Home page content</div>,
) =>
  renderWithRouter(
    <AppLayout>
      <ErrorPages home={home} />
    </AppLayout>,
    { url: initialPath },
  )

describe('AppLayout — per-route ErrorBoundary', () => {
  afterEach(() => {
    shouldThrow = true
    personMounts = 0
  })

  it('десктоп: падение страницы — Header остаётся, вместо контента ErrorState с фиксированным текстом и ссылкой на главную', () => {
    renderErrorApp('/popular')

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(
      within(screen.getByRole('banner')).getByRole('button', {
        name: 'Popular',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(ROUTE_FALLBACK_TEXT)).toBeInTheDocument()
    expect(screen.queryByText('boom')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('мобильный: падение страницы — MobileHeader и BottomNav остаются в дереве', () => {
    setViewportWidth(MOBILE_WIDTH)
    renderErrorApp('/popular')

    expect(
      within(screen.getByRole('banner')).getByText('Popular'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lists/ })).toBeInTheDocument()
    expect(screen.getByText(ROUTE_FALLBACK_TEXT)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to home' }),
    ).toBeInTheDocument()
  })

  it('падение самой / — ссылки на главную нет (key не сменится, она была бы no-op), retry есть', () => {
    renderErrorApp('/', <Bomb />)

    expect(screen.getByText(ROUTE_FALLBACK_TEXT)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Back to home' }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Попробовать снова')).toBeInTheDocument()
  })

  it('«Попробовать снова» восстанавливает страницу, если причина устранена — chrome вокруг сохраняется', () => {
    renderErrorApp('/popular')

    expect(screen.getByText(ROUTE_FALLBACK_TEXT)).toBeInTheDocument()

    shouldThrow = false
    fireEvent.click(screen.getByText('Попробовать снова'))

    expect(screen.getByText('Recovered page content')).toBeInTheDocument()
    expect(screen.queryByText(ROUTE_FALLBACK_TEXT)).not.toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
  })

  it('падение страницы репортится через captureRouteError(error, errorInfo)', () => {
    renderErrorApp('/popular')

    expect(captureRouteError).toHaveBeenCalledTimes(1)
    const [error, errorInfo] = vi.mocked(captureRouteError).mock.calls[0]
    expect(error.message).toBe('boom')
    expect(errorInfo).toHaveProperty('componentStack')
  })

  it('навигация с упавшего роута на другой сбрасывает границу сама (key={pathname}), без retry', async () => {
    renderErrorApp('/popular')

    expect(screen.getByText(ROUTE_FALLBACK_TEXT)).toBeInTheDocument()

    await navigateTo('/')

    expect(await screen.findByText('Home page content')).toBeInTheDocument()
    expect(screen.queryByText(ROUTE_FALLBACK_TEXT)).not.toBeInTheDocument()
  })

  // Принятое следствие key={pathname} (см. Overview плана): смена параметра динамического роута
  // меняет pathname — граница и страница под ней ремаунтятся, а не переиспользуются.
  it('/person/1 → /person/2: страница ремаунтится (зафиксированное следствие key={pathname})', async () => {
    renderErrorApp('/person/1')

    await waitFor(() => expect(personMounts).toBe(1))

    await navigateTo('/person/2')

    await waitFor(() => expect(personMounts).toBe(2))
    expect(screen.getByText('Person page content')).toBeInTheDocument()
  })
})
