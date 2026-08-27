import { useViewport } from '@shared/lib'
import { Header } from '@widgets/header'
import { BottomNav, MobileHeader } from '@widgets/mobile-chrome'
import { Outlet, useLocation } from 'react-router'

type BottomNavKey =
  | 'home'
  | 'search'
  | 'lists'
  | 'popular'
  | 'recommendations'
  | 'profile'

type RouteChromeConfig = {
  /** Ключ для `Header`'s `activeNav` — набор частично пересекается с `active` ниже, см.
   * докблок `AppLayout` про полную таблицу соответствия. */
  activeNav: string
  active: BottomNavKey
  title: string
}

/**
 * route → chrome-конфиг карта (Task 6 плана docs/plans/20260827-mobile-first-adaptive-layout.md).
 * Заполнена только для маршрутов, уже подключённых под этот layout — `/favorites`, `/popular`,
 * `/recommendations` (см. Task 3-5). Task 6 сознательно НЕ подключает сюда `/`, `/movie/:id`,
 * `/search` — эти три страницы всё ещё рендерят Header/MobileHeader+BottomNav напрямую сами
 * (см. HomeDesktop/HomeMobile, MovieDesktop/MovieMobile, SearchDesktop/SearchMobile), и подключение
 * их роутов под `AppLayout` уже сейчас дало бы двойной chrome в DOM одновременно с их
 * собственным. Tasks 8/9/10 каждый добавит свою запись в эту карту и одновременно уберёт
 * собственный inline-рендер chrome из соответствующей страницы — как часть их собственного
 * слияния Desktop/Mobile, не заранее здесь. В частности:
 *   - `/` (Task 8): простой случай, `activeNav: 'home'`, `active: 'home'`.
 *   - `/movie/:id` (Task 9): НЕ простой случай — `MobileHeader` там получает `onBack`,
 *     `showSearch={false}` и `rightAction` (кнопка "поделиться", завязанная на page-local
 *     CSS-класс `MovieMobile.module.css`'s `.shareBtn`), которые эта карта в её текущем виде
 *     (только `title`) не умеет выразить; `BottomNav`'s `active` там — `'search'`, а не `'home'`,
 *     тоже не выводится из пути тривиально. Тask 9 должен расширить `RouteChromeConfig` (например,
 *     необязательными `onBack`/`showSearch`/`rightAction` слотами) или ввести отдельный
 *     механизм передачи `rightAction` от страницы, а не просто дописать `title` в эту таблицу.
 *   - `/search` (Task 10): `Header`'s `activeNav` там читается не из пути (путь один и тот же),
 *     а из `?type` в URL (`useFilterState()`/`getFilterFromSearchParams`) — этой карте, ключ
 *     которой строится по `pathname`, нужен доступ к `useSearchParams()` для этого случая.
 *
 * Полная таблица соответствия `Header.activeNav` ↔ `BottomNav.active` (множества пересекаются
 * только частично, см. чек-бокс Task 6):
 *   home            → activeNav='home',            active='home'
 *   movie/series/anime → activeNav=<тот же ключ>,  active=нет соответствия (BottomNav не умеет)
 *   favorites       → activeNav='favorites',       active='lists' (разные имена одного пункта)
 *   popular         → activeNav='popular',         active='popular'
 *   recommendations → activeNav='recommendations', active='recommendations'
 *   search          → activeNav=нет соответствия (Header не умеет), active='search'
 *   profile         → activeNav=нет соответствия,  active='profile'
 */
const ROUTE_CHROME: Record<string, RouteChromeConfig> = {
  '/favorites': {
    activeNav: 'favorites',
    active: 'lists',
    title: 'Favorites',
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
}

/**
 * Единая точка выбора навигационного chrome (`Header` vs `MobileHeader`+`BottomNav`) — заменяет
 * временное `useViewport`-ветвление, повторявшееся в каждой из `Favorites`/`Popular`/
 * `Recommendations` (Task 3-5 плана). Выбран вариант A (layout-route с `<Outlet/>`), а не
 * `SiteChrome`-виджет: не создаёт новый слайс `widgets/`, не требует кросс-импорта
 * `@widgets/header`+`@widgets/mobile-chrome` из третьего независимого виджета (что нарушало бы
 * границы FSD между двумя и так независимыми друг от друга виджетами), и позволяет вывести
 * `activeNav`/`active` из `useLocation()` вместо прокидывания пропа с каждой страницы.
 * Конкретного блокера для варианта A не нашлось — запасной `SiteChrome` не потребовался.
 *
 * `Header` и `MobileHeader`+`BottomNav` НЕ монтируются одновременно с видимостью через
 * `display: none` — выбор через `useViewport()` в этой единственной точке решает, какой вариант
 * вообще попадает в дерево. Причина: `Header`'s `?q`-debounce-эффект (`Header.tsx:84-124`)
 * пишет/стирает `?q` в URL безусловно, независимо от `variant`/видимости — скрытый `display:
 * none` `Header` продолжил бы это делать на роутах вроде `/favorites`, где `?q` не нужен и не
 * ожидается. Явное условное (не)монтирование через `useViewport()` — тот самый точечный JS-форк,
 * зафиксированный в Task 1/Audit как оправданный (CSS `hover`/`pointer` не может выразить "не
 * монтировать вообще"). Ни один из трёх роутов, подключённых сейчас, не использует
 * `variant='search'` — эта ветка `Header` (и её ⌘K-листенер, и её `?q`-эффект в контексте
 * реального поиска) присоединится только вместе с `/search` в Task 10.
 */
export const AppLayout = () => {
  const { pathname } = useLocation()
  const { isMobile } = useViewport()
  const config = ROUTE_CHROME[pathname]

  return (
    <>
      {isMobile ? (
        <MobileHeader title={config?.title} />
      ) : (
        <Header activeNav={config?.activeNav} />
      )}

      <Outlet />

      {isMobile && config && <BottomNav active={config.active} />}
    </>
  )
}
