import { reatomRoute } from '@reatom/core'
import type { RouteChild } from '@reatom/core'
import { lazyNamed } from '@shared/lib'

import { AppLayout } from './layouts/AppLayout'
import { NotFound } from './ui/NotFound'

// Route-based code splitting (роадмап 2.5.3): страничные слайсы экспортируют компонент
// именованно, не `default`, поэтому обычный `lazy(() => import(...))` не резолвится — нужен
// `lazyNamed`. Suspense для загрузки чанка — в AppLayout, вокруг outlet.
const HomePage = lazyNamed(() => import('../pages/home'), 'HomePage')
const MoviePage = lazyNamed(() => import('../pages/movie'), 'MoviePage')
const FavoritesPage = lazyNamed(
  () => import('../pages/favorites'),
  'FavoritesPage',
)
const WatchedPage = lazyNamed(() => import('../pages/watched'), 'WatchedPage')
const WatchlistPage = lazyNamed(
  () => import('../pages/watchlist'),
  'WatchlistPage',
)
const PopularPage = lazyNamed(() => import('../pages/popular'), 'PopularPage')
const RecommendationsPage = lazyNamed(
  () => import('../pages/recommendations'),
  'RecommendationsPage',
)
const SearchPage = lazyNamed(() => import('../pages/search'), 'SearchPage')
const ProfilePage = lazyNamed(() => import('../pages/profile'), 'ProfilePage')
const PersonPage = lazyNamed(() => import('../pages/person'), 'PersonPage')

// Pathless layout: матчится на любом URL, chrome рисуется и для неизвестного пути. `is404` из
// ядра при таком layout всегда false, поэтому 404 — это пустой outlet.
export const layoutRoute = reatomRoute(
  {
    layout: true,
    render: ({ outlet }): RouteChild => (
      <AppLayout>{outlet()[0] ?? <NotFound />}</AppLayout>
    ),
  },
  'routes.layout',
)

// Дочерние роуты регистрируются в layoutRoute.routes самим вызовом — ссылки на них не нужны:
// навигация идёт через <a href> / urlAtom.go и строители @shared/config.
layoutRoute.reatomRoute(
  { path: '', render: (): RouteChild => <HomePage /> },
  'routes.home',
)

// Невалидный :id роут не снимает: страница сама показывает «not found» (как на main).
layoutRoute.reatomRoute(
  {
    path: 'movie/:id',
    render: (self): RouteChild => <MoviePage id={self().id} />,
  },
  'routes.movie',
)

layoutRoute.reatomRoute(
  {
    path: 'person/:id',
    render: (self): RouteChild => <PersonPage id={self().id} />,
  },
  'routes.person',
)

layoutRoute.reatomRoute(
  { path: 'favorites', render: (): RouteChild => <FavoritesPage /> },
  'routes.favorites',
)

layoutRoute.reatomRoute(
  { path: 'watched', render: (): RouteChild => <WatchedPage /> },
  'routes.watched',
)

layoutRoute.reatomRoute(
  { path: 'watchlist', render: (): RouteChild => <WatchlistPage /> },
  'routes.watchlist',
)

layoutRoute.reatomRoute(
  { path: 'popular', render: (): RouteChild => <PopularPage /> },
  'routes.popular',
)

layoutRoute.reatomRoute(
  {
    path: 'recommendations',
    render: (): RouteChild => <RecommendationsPage />,
  },
  'routes.recommendations',
)

layoutRoute.reatomRoute(
  { path: 'search', render: (): RouteChild => <SearchPage /> },
  'routes.search',
)

layoutRoute.reatomRoute(
  { path: 'profile', render: (): RouteChild => <ProfilePage /> },
  'routes.profile',
)
