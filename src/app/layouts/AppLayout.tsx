import { filters } from '@features/catalog-filter'
import { urlAtom } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { matchRoutePattern, paths } from '@shared/config'
import type { RoutePattern } from '@shared/config'
import { trackPageview, useViewport } from '@shared/lib'
import {
  ErrorBoundary,
  ErrorState,
  IconButton,
  ShareIcon,
  Spinner,
} from '@shared/ui'
import type { ErrorBoundaryFallbackParams } from '@shared/ui'
import { Header } from '@widgets/header'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'
import type { ReactNode } from 'react'
import { Suspense, useEffect } from 'react'

import { captureRouteError } from '../sentry'

import s from './AppLayout.module.css'

type BottomNavKey =
  | 'home'
  | 'search'
  | 'lists'
  | 'popular'
  | 'recommendations'
  | 'profile'

type RouteChromeConfig = {
  /** Ключ для `Header`'s `activeNav` — набор частично пересекается с `active` ниже, см.
   * докблок `AppLayout` про полную таблицу соответствия. Необязательный: `/movie/:id`
   * (см. `MOVIE_CHROME` ниже) не подсвечивает ни один пункт `Header`'s nav-pills — воспроизводит
   * поведение голого `<Header />` из удалённого `MovieDesktop.tsx`. */
  activeNav?: string
  active: BottomNavKey
  /**
   * Необязательный — `/` (Task 8) сознательно не задаёт `title`: `MobileHeader` без `title`
   * рендерит логотип + search-триггер (`showSearch && !title`, см. `MobileHeader.tsx`), что
   * воспроизводит поведение исходного `HomeMobile.tsx` (`<MobileHeader />` без пропов вовсе).
   * `/favorites`/`/popular`/`/recommendations` передают `title`, потому что их мобильный
   * header — не входная точка поиска, а простой заголовок страницы.
   */
  title?: string
  /**
   * Task 9 (`/movie/:id`) добавила три поля ниже — `MobileHeader` там ведёт себя иначе, чем
   * простой title-кейс: кнопка "назад" вместо логотипа, без search-триггера, с кастомным правым
   * действием ("поделиться"). `onBack` — булев флаг, а не сама функция: `AppLayout` сам вызывает
   * `() => history.back()`, странице не нужно прокидывать колбэк.
   * `rightAction` — обычный `ReactNode`, а не render-prop/функция: кнопка "поделиться" не зависит
   * ни от навигации, ни от какого-либо page-local состояния (в исходном `MovieMobile.tsx` она
   * тоже была без `onClick`), поэтому лишний уровень функции не нужен — если будущему роуту
   * потребуется action, которому нужна навигация/пропс от страницы, тогда стоит завести
   * render-prop, не раньше.
   */
  onBack?: boolean
  showSearch?: boolean
  rightAction?: ReactNode
}

/**
 * route → chrome-конфиг карта (Task 6 плана docs/plans/20260827-mobile-first-adaptive-layout.md).
 * Заполнена для маршрутов, уже подключённых под этот layout — `/favorites`, `/popular`,
 * `/recommendations` (Task 3-5), `/profile` (client-only профиль, отдельный план
 * docs/plans/completed/20260916-user-profile-block.md), `/` (Task 8), `/movie/:id` (Task 9, см.
 * `MOVIE_CHROME` ниже — не входит в эту карту, потому что ключ здесь — точный `pathname`, а
 * `/movie/123` не совпадёт с литералом `/movie/:id`), `/search` (Task 10, см. `SEARCH_CHROME`
 * ниже — по той же причине, что `MOVIE_CHROME`, не входит в эту карту, хоть у `/search` и нет
 * динамического сегмента: у этого роута `activeNav` вычисляется не по статической карте, а из
 * `?type`, см. ниже) и `/person/:id` (Task 10, см. `PERSON_CHROME` ниже — не входит в эту карту
 * по той же причине, что `MOVIE_CHROME`: `/person/123` не совпадёт с литералом `/person/:id`).
 *   - `/` (Task 8): простой случай, `activeNav: 'home'`, `active: 'home'`, `title` не задаётся
 *     (см. докблок `RouteChromeConfig.title` — воспроизводит исходное поведение `HomeMobile`).
 *   - `/movie/:id` (Task 9): НЕ простой случай — см. `MOVIE_CHROME` и докблок
 *     `RouteChromeConfig.onBack`/`rightAction` выше.
 *   - `/search` (Task 10): `Header`'s `activeNav` там читается не из пути (путь один и тот же),
 *     а из `?type` в URL (`useFilterState()`/`getFilterFromSearchParams`) — реализовано в
 *     `AppLayout` ниже через `filters().type` + `isSearchRoute`, см. `SEARCH_CHROME` и
 *     докблок `AppLayout`.
 *   - `/person/:id` (Task 10): НЕ простой случай, аналогично `/movie/:id` — см. `PERSON_CHROME`
 *     ниже.
 *
 * Полная таблица соответствия `Header.activeNav` ↔ `BottomNav.active` (множества пересекаются
 * только частично, см. чек-бокс Task 6):
 *   home            → activeNav='home',            active='home'
 *   movie/series/anime → activeNav=<тот же ключ>,  active=нет соответствия (BottomNav не умеет)
 *   favorites       → activeNav='favorites',       active='lists' (разные имена одного пункта)
 *   watched         → activeNav=нет соответствия,  active='lists'
 *   watchlist       → activeNav=нет соответствия,  active='lists'
 *   popular         → activeNav='popular',         active='popular'
 *   recommendations → activeNav='recommendations', active='recommendations'
 *   movie detail    → activeNav=не задан (нет своего пункта), active='search' (см. MOVIE_CHROME)
 *   person detail   → activeNav=не задан (нет своего пункта), active='search' (см. PERSON_CHROME)
 *   search          → activeNav=нет соответствия (Header не умеет), active='search'
 *   profile         → activeNav=нет соответствия,  active='profile'
 */
const ROUTE_CHROME: Partial<Record<RoutePattern, RouteChromeConfig>> = {
  '/': {
    activeNav: 'home',
    active: 'home',
  },
  '/favorites': {
    activeNav: 'favorites',
    active: 'lists',
    title: 'Favorites',
  },
  // activeNav не задан — у Header нет nav-pill для Watched; active='lists' — паритет с /favorites.
  '/watched': {
    active: 'lists',
    title: 'Watched',
  },
  // Как /watched: у Header нет nav-pill для Watchlist, active='lists' — как у остальных списков.
  '/watchlist': {
    active: 'lists',
    title: 'Watchlist',
  },
  '/popular': {
    activeNav: 'popular',
    active: 'popular',
    title: 'Popular',
  },
  '/recommendations': {
    activeNav: 'recommendations',
    active: 'recommendations',
    title: 'Recommended for you',
  },
  // activeNav не задан — у Header нет nav-pill профиля (см. таблицу выше).
  '/profile': {
    active: 'profile',
    title: 'Profile',
  },
}

/**
 * Chrome-конфиг для `/movie/:id` (Task 9) — отдельная константа, а не запись в `ROUTE_CHROME`,
 * потому что конфиг содержит JSX (`rightAction`) и исторически жил отдельно; выбирается по
 * `matchRoutePattern(pathname) === '/movie/:id'` в `AppLayout` ниже.
 * `active: 'search'` — у detail-страницы фильма нет своего пункта в `BottomNav`, ближайший по
 * смыслу раздел — каталог/поиск (то же значение, что было жёстко зашито в удалённом
 * `MovieMobile.tsx`'s `<BottomNav active='search' />`). `rightAction` — кнопка "поделиться" через
 * общий `IconButton`+`ShareIcon` (`@shared/ui`) вместо удалённого page-local
 * `MovieMobile.module.css`'s `.shareBtn` — CSS-класс всё равно исчез вместе с файлом, а
 * `IconButton` уже даёт визуально эквивалентную круглую иконку-кнопку без нового CSS.
 */
const MOVIE_CHROME: RouteChromeConfig = {
  active: 'search',
  onBack: true,
  showSearch: false,
  rightAction: (
    <IconButton aria-label='Share'>
      <ShareIcon />
    </IconButton>
  ),
}

/**
 * Chrome-конфиг для `/person/:id` (Task 10) — отдельная константа, а не запись в `ROUTE_CHROME`
 * и не переиспользование `MOVIE_CHROME`, по трём отдельным причинам:
 *   1. Выбирается по `matchRoutePattern(pathname) === '/person/:id'` в `AppLayout` ниже, как
 *      и `MOVIE_CHROME`.
 *   2. `active: 'search'` — у detail-страницы персоны нет своего пункта в `BottomNav`, ближайший
 *      по смыслу раздел — каталог/поиск, то же значение, что и у `MOVIE_CHROME` (см. докблок
 *      `MOVIE_CHROME` выше).
 *   3. Здесь **нет** `rightAction` — в отличие от `MOVIE_CHROME`. Кнопка "поделиться" у
 *      `MOVIE_CHROME` воспроизводила поведение удалённого `MovieMobile.tsx`; для `/person/:id`
 *      такой исходной страницы не было, добавлять эту кнопку заново не за чем (подтверждено
 *      пользователем при планировании — см. «Ключевые решения» плана
 *      docs/plans/20260916-person-detail-page.md). Кнопка Share на `/movie/:id` вдобавок признана
 *      мёртвым контролом (`docs/backlog/dead-header-controls.md`) — лишний повод не копировать её
 *      сюда.
 */
const PERSON_CHROME: RouteChromeConfig = {
  active: 'search',
  onBack: true,
  showSearch: false,
}

/**
 * Chrome-конфиг для `/search` (Task 10) — тоже отдельная константа, не запись в `ROUTE_CHROME`,
 * хоть тут и нет динамического сегмента: `pathname` для `/search` статичен и совпадение по
 * литералу сработало бы, но `Header`'s `activeNav` здесь читается не из пути (см. докблок
 * `ROUTE_CHROME` выше и `RouteChromeConfig.activeNav`), а из `?type` — единственный пункт, где
 * значение приходит из `filters().type`, а не из статической карты. Держать это как обычную
 * запись в `ROUTE_CHROME` означало бы либо хранить там функцию вместо строки (усложняет тип
 * остальных пяти статических записей ради одной), либо вычислять `activeNav` инлайново в
 * `AppLayout` — выбран второй вариант: `SEARCH_CHROME` даёт только не-`activeNav` часть
 * (`active`/`title`/`onBack`/`showSearch`/`rightAction`, все — как для обычного простого
 * маршрута), а `activeNav` дополняется в `AppLayout` из `searchParams.get('type')`.
 * `active: 'search'` — единственный ключ `BottomNav`, у которого нет аналога в `Header`
 * (см. таблицу соответствия выше). `title`/`onBack`/`showSearch`/`rightAction` не заданы — на
 * мобильном `/search` рендерит голый `<MobileHeader />` без пропов, воспроизводя точное
 * поведение удалённого `SearchMobile.tsx` (`<MobileHeader />` без единого пропа).
 * `Header`'s `variant='search'` (инлайн-поиск вместо nav pills, ⌘K-листенер) тоже не часть
 * `RouteChromeConfig` — это чисто десктопная развилка `Header`, вычисляется в `AppLayout`
 * рядом с `activeNav` через тот же `isSearchRoute`.
 */
const SEARCH_CHROME: RouteChromeConfig = {
  active: 'search',
}

/**
 * Фолбэк per-route `ErrorBoundary` (роадмап 2.6, docs/plans/20260916-per-route-error-boundaries.md)
 * — тот же `ErrorState`, что у `GlobalErrorBoundary`, плюс ссылка на главную через
 * `secondaryAction`-слот (обычная `<a href>`, клик перехватывает urlAtom).
 * Описание фиксированное, не `error.message`: сюда долетают баги рендера и сбои чанков, их текст
 * ("Cannot read properties of undefined…", URL чанка) пользователю ничего не говорит.
 * На самой `/` ссылки нет: `pathname` не меняется → `key` тот же → граница не сбросится, ссылка
 * была бы no-op; остаётся только retry.
 */
const renderRouteErrorFallback = (
  { reset }: ErrorBoundaryFallbackParams,
  isHome: boolean,
) => (
  <ErrorState
    title='Something went wrong'
    description='An unexpected error occurred. Please try again.'
    onRetry={reset}
    secondaryAction={
      isHome ? undefined : (
        <a className={s.homeLink} href={paths.home()}>
          Back to home
        </a>
      )
    }
  />
)

/**
 * Единая точка выбора навигационного chrome (`Header` vs `MobileHeader`+`BottomNav`) — заменяет
 * временное `useViewport`-ветвление, повторявшееся в каждой из `Favorites`/`Popular`/
 * `Recommendations` (Task 3-5 плана). Выбран вариант A (layout-route с outlet), а не
 * `SiteChrome`-виджет: не создаёт новый слайс `widgets/`, не требует кросс-импорта
 * `@widgets/header`+`@widgets/mobile-chrome` из третьего независимого виджета (что нарушало бы
 * границы FSD между двумя и так независимыми друг от друга виджетами), и позволяет вывести
 * `activeNav`/`active` из `urlAtom().pathname` вместо прокидывания пропа с каждой страницы.
 * Конкретного блокера для варианта A не нашлось — запасной `SiteChrome` не потребовался.
 *
 * `Header` и `MobileHeader`+`BottomNav` НЕ монтируются одновременно с видимостью через
 * `display: none` — выбор через `useViewport()` в этой единственной точке решает, какой вариант
 * вообще попадает в дерево. Причина: `Header`'s `?q`-debounce-эффект (`Header.tsx:84-124`)
 * пишет/стирает `?q` в URL безусловно, независимо от `variant`/видимости — скрытый `display:
 * none` `Header` продолжил бы это делать на роутах вроде `/favorites`, где `?q` не нужен и не
 * ожидается. Явное условное (не)монтирование через `useViewport()` — тот самый точечный JS-форк,
 * зафиксированный в Task 1/Audit как оправданный (CSS `hover`/`pointer` не может выразить "не
 * монтировать вообще"). На момент Task 1 ни один из пяти подключённых роутов (`/`, `/favorites`,
 * `/popular`, `/recommendations`, `/movie/:id`) не использовал `variant='search'` — эта ветка
 * `Header` (и её ⌘K-листенер, и её `?q`-эффект в контексте реального поиска) присоединится
 * только вместе с `/search` в Task 10 (актуальный список роутов под layout — в `routes.tsx`;
 * `/profile` тоже подключён и `variant='search'` не использует).
 *
 * **Task 10 (`/search`) добавила второй JS-fork поверх этого.** `/search` подключён под этот
 * layout (см. `routes.tsx`) вместо инлайн-рендера chrome внутри `Search` — тот же принцип, что
 * применялся к `/`/`/favorites`/`/popular`/`/recommendations`/`/movie/:id` раньше. Отличие —
 * `Header`'s `activeNav` там читается не из `pathname` (один и тот же путь для всех значений
 * `?type`), а из `filters().type`; `Header`'s `variant='search'` (инлайн-поиск
 * вместо nav pills) — тоже развилка, зависящая от текущего роута, а не от `RouteChromeConfig`
 * (см. `SEARCH_CHROME` выше). Оба вычисляются здесь через `isSearchRoute`, отдельно от
 * `config`/`ROUTE_CHROME`/`MOVIE_CHROME`.
 */
type AppLayoutProps = {
  /** Страница текущего роута (или NotFound) — из render layout-роута в routes.tsx. */
  children: ReactNode
}

// reatomComponent: читает urlAtom/filters — в обычном компоненте React Compiler закэшировал бы
// прочитанное значение. Роуты не импортирует (цикл routes.tsx ↔ AppLayout.tsx): chrome
// выбирается по шаблону пути из @shared/config.
export const AppLayout = reatomComponent(({ children }: AppLayoutProps) => {
  const { pathname } = urlAtom()
  const { isMobile } = useViewport()
  const pattern = matchRoutePattern(pathname)
  const isSearchRoute = pattern === '/search'
  // Неизвестный путь (страница NotFound) получает chrome главной — с BottomNav на мобильном.
  const config =
    pattern === '/movie/:id'
      ? MOVIE_CHROME
      : pattern === '/person/:id'
        ? PERSON_CHROME
        : isSearchRoute
          ? SEARCH_CHROME
          : (ROUTE_CHROME[pattern ?? '/'] ?? ROUTE_CHROME['/'])
  const headerVariant = isSearchRoute ? 'search' : 'default'
  // filters().type уже `?type || null` (getFilterFromSearchParams), поэтому `?type=` даёт
  // 'search', а не пустую строку.
  const headerActiveNav = isSearchRoute
    ? (filters().type ?? 'search')
    : config?.activeNav

  // Page view tracking (Task 5, docs/plans/20260910-web-vitals-analytics.md): реагирует только
  // на смену `pathname` — намеренно не на `location.key`/`search`, иначе debounce-запись `?q` в
  // Header (QUERY_DEBOUNCE_MS) или клики по фильтрам на /search спамили бы pageview на каждое
  // изменение query-параметров внутри одной и той же страницы.
  useEffect(() => {
    trackPageview()
  }, [pathname])

  return (
    <>
      {isMobile ? (
        <MobileHeader
          title={config?.title}
          showSearch={config?.showSearch}
          onBack={config?.onBack ? () => history.back() : undefined}
          rightAction={config?.rightAction}
        />
      ) : (
        <Header variant={headerVariant} activeNav={headerActiveNav} />
      )}

      {/* Suspense-боундари здесь — про загрузку JS-чанка страницы (route-based code
      splitting, роадмап 2.5.3), не про данные: каждая страница уже оборачивает свою
      async-секцию через `<AsyncContent>` по статусу ресурса (см. AGENTS.md, "Loading / Empty /
      Error везде"). Единая точка на всё дерево роутов — как и сам outlet (`children`).
      Per-route ErrorBoundary (роадмап 2.6) — снаружи Suspense, чтобы ловить и сбой загрузки чанка, и runtime-ошибку страницы, не
      теряя chrome вокруг. Перехватывает раньше GlobalErrorBoundary — поэтому сам репортит в Sentry
      через onError. `key={pathname}` сбрасывает границу при переходе на другой роут; принятое
      следствие — ремаунт Suspense+страницы и на смене параметра (`/movie/1 → /movie/2`), без
      удержания старого контента во время загрузки нового. Второе принятое следствие: на
      `/search` смена `?q`/фильтров не меняет `pathname` — упавшая страница остаётся в фолбэке до
      retry/перехода (ключ по `search` ремаунтил бы страницу на каждый ввод и клик по фильтру). */}
      <ErrorBoundary
        key={pathname}
        fallback={params => renderRouteErrorFallback(params, pathname === '/')}
        onError={captureRouteError}
      >
        <Suspense fallback={<Spinner />}>{children}</Suspense>
      </ErrorBoundary>

      {isMobile && config && <BottomNav active={config.active} />}
    </>
  )
}, 'AppLayout')
