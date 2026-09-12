import { lazyNamed } from '@shared/lib'
import { createBrowserRouter } from 'react-router'

import { AppLayout } from './layouts/AppLayout'

// Все шесть роутов теперь под `AppLayout` (Task 10 плана
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
const PopularPage = lazyNamed(() => import('../pages/popular'), 'PopularPage')
const RecommendationsPage = lazyNamed(
  () => import('../pages/recommendations'),
  'RecommendationsPage',
)
const SearchPage = lazyNamed(() => import('../pages/search'), 'SearchPage')

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/movie/:id', element: <MoviePage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/popular', element: <PopularPage /> },
      { path: '/recommendations', element: <RecommendationsPage /> },
      { path: '/search', element: <SearchPage /> },
    ],
  },
])
