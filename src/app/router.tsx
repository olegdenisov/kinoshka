import { createBrowserRouter } from 'react-router'

import { FavoritesPage } from '../pages/favorites'
import { HomePage } from '../pages/home'
import { MoviePage } from '../pages/movie'
import { PopularPage } from '../pages/popular'
import { RecommendationsPage } from '../pages/recommendations'
import { SearchPage } from '../pages/search'
import { AppLayout } from './layouts/AppLayout'

// `/`, `/search`, `/movie/:id` остаются top-level роутами вне `AppLayout` — Home/Movie/Search
// ещё не слиты в единый адаптивный компонент (Task 8/9/10 плана
// docs/plans/20260827-mobile-first-adaptive-layout.md) и продолжают рендерить свой
// Header/MobileHeader+BottomNav напрямую сами; подключение их роутов под `AppLayout` сейчас дало
// бы двойной chrome в дереве. Только уже слитые `/favorites`, `/popular`, `/recommendations`
// (Task 3-5) переезжают под layout — каждая из Task 8/9/10 сама уберёт inline-рендер chrome из
// своей страницы и переместит свой роут сюда же, как часть собственного слияния.
export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/search', element: <SearchPage /> },
  { path: '/movie/:id', element: <MoviePage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/popular', element: <PopularPage /> },
      { path: '/recommendations', element: <RecommendationsPage /> },
    ],
  },
])
