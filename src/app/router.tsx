import { createBrowserRouter } from 'react-router'

import { FavoritesPage } from '../pages/favorites'
import { HomePage } from '../pages/home'
import { MoviePage } from '../pages/movie'
import { PopularPage } from '../pages/popular'
import { RecommendationsPage } from '../pages/recommendations'
import { SearchPage } from '../pages/search'
import { AppLayout } from './layouts/AppLayout'

// `/search`, `/movie/:id` остаются top-level роутами вне `AppLayout` — Movie/Search ещё не
// слиты в единый адаптивный компонент (Task 9/10 плана
// docs/plans/20260827-mobile-first-adaptive-layout.md) и продолжают рендерить свой
// Header/MobileHeader+BottomNav напрямую сами; подключение их роутов под `AppLayout` сейчас дало
// бы двойной chrome в дереве. `/favorites`, `/popular`, `/recommendations` (Task 3-5) и `/`
// (Task 8 — Home слит, CATALOG-мок удалён, chrome вынесен) уже под layout — каждая из Task 9/10
// сама уберёт inline-рендер chrome из своей страницы и переместит свой роут сюда же, как часть
// собственного слияния.
export const router = createBrowserRouter([
  { path: '/search', element: <SearchPage /> },
  { path: '/movie/:id', element: <MoviePage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/popular', element: <PopularPage /> },
      { path: '/recommendations', element: <RecommendationsPage /> },
    ],
  },
])
