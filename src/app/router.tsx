import * as Sentry from '@sentry/react'
import { lazyNamed } from '@shared/lib'
import { createBrowserRouter } from 'react-router'

import { AppLayout } from './layouts/AppLayout'

// Sentry.wrapCreateBrowserRouter (Task 2b, план 20260915-telemetry-dashboard-sentry-alerts.md) —
// вместе с reactRouterBrowserTracingIntegration (sentry.ts) группирует параметризованные роуты
// (/movie/:id) в один transaction name вместо одного transaction на конкретный фильм. Порядок
// инициализации (initSentry() ДО этого модуля) обеспечен sentry-bootstrap.ts/main.tsx — см.
// WHY-комментарий там.
const wrappedCreateBrowserRouter =
  Sentry.wrapCreateBrowserRouter(createBrowserRouter)

// Все восемь роутов теперь под `AppLayout` (Task 10 плана
// docs/plans/20260827-mobile-first-adaptive-layout.md завершила перенос `/search` — последнего
// оставшегося top-level роута). `Search` больше не рендерит Header/MobileHeader+BottomNav сама
// — chrome для `/search` (включая activeNav из `?type` и Header's variant='search') реализован
// в src/app/layouts/AppLayout.tsx (см. SEARCH_CHROME/isSearchRoute).
//
// Route-based code splitting (роадмап 2.5.3, docs/plans/20260912-performance-budgets-bundle-visualization.md):
// страничные слайсы экспортируют компонент именованно, не `default`, поэтому обычный
// `lazy(() => import(...))` не резолвится — нужен `lazyNamed`.
const HomePage = lazyNamed(() => import('../pages/home'), 'HomePage')
const MoviePage = lazyNamed(() => import('../pages/movie'), 'MoviePage')
const FavoritesPage = lazyNamed(
  () => import('../pages/favorites'),
  'FavoritesPage',
)
const WatchedPage = lazyNamed(() => import('../pages/watched'), 'WatchedPage')
const PopularPage = lazyNamed(() => import('../pages/popular'), 'PopularPage')
const RecommendationsPage = lazyNamed(
  () => import('../pages/recommendations'),
  'RecommendationsPage',
)
const SearchPage = lazyNamed(() => import('../pages/search'), 'SearchPage')
const ProfilePage = lazyNamed(() => import('../pages/profile'), 'ProfilePage')
const PersonPage = lazyNamed(() => import('../pages/person'), 'PersonPage')

export const router = wrappedCreateBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/movie/:id', element: <MoviePage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/watched', element: <WatchedPage /> },
      { path: '/popular', element: <PopularPage /> },
      { path: '/recommendations', element: <RecommendationsPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/person/:id', element: <PersonPage /> },
    ],
  },
])
