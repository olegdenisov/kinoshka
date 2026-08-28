import { createBrowserRouter } from 'react-router'

import { FavoritesPage } from '../pages/favorites'
import { HomePage } from '../pages/home'
import { MoviePage } from '../pages/movie'
import { PopularPage } from '../pages/popular'
import { RecommendationsPage } from '../pages/recommendations'
import { SearchPage } from '../pages/search'
import { AppLayout } from './layouts/AppLayout'

// `/search` остаётся top-level роутом вне `AppLayout` — Search ещё не слит в единый адаптивный
// компонент (Task 10 плана docs/plans/20260827-mobile-first-adaptive-layout.md) и продолжает
// рендерить свой Header/MobileHeader+BottomNav напрямую сам; подключение его роута под
// `AppLayout` сейчас дало бы двойной chrome в дереве. `/`, `/favorites`, `/popular`,
// `/recommendations` (Tasks 3-5/8) и `/movie/:id` (Task 9 — Movie слит, chrome вынесен в
// AppLayout's MOVIE_CHROME, см. src/app/layouts/AppLayout.tsx) уже под layout. Task 10 сама
// уберёт inline-рендер chrome из Search и переместит и его роут сюда же, как часть собственного
// слияния.
export const router = createBrowserRouter([
  { path: '/search', element: <SearchPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/movie/:id', element: <MoviePage /> },
      { path: '/favorites', element: <FavoritesPage /> },
      { path: '/popular', element: <PopularPage /> },
      { path: '/recommendations', element: <RecommendationsPage /> },
    ],
  },
])
