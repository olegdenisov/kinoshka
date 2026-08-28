import { createBrowserRouter } from 'react-router'

import { FavoritesPage } from '../pages/favorites'
import { HomePage } from '../pages/home'
import { MoviePage } from '../pages/movie'
import { PopularPage } from '../pages/popular'
import { RecommendationsPage } from '../pages/recommendations'
import { SearchPage } from '../pages/search'
import { AppLayout } from './layouts/AppLayout'

// Все шесть роутов теперь под `AppLayout` (Task 10 плана
// docs/plans/20260827-mobile-first-adaptive-layout.md завершила перенос `/search` — последнего
// оставшегося top-level роута). `Search` больше не рендерит Header/MobileHeader+BottomNav сама
// — chrome для `/search` (включая activeNav из `?type` и Header's variant='search') реализован
// в src/app/layouts/AppLayout.tsx (см. SEARCH_CHROME/isSearchRoute).
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
