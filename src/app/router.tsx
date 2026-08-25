import { createBrowserRouter } from 'react-router'

import { FavoritesPage } from '../pages/favorites'
import { HomePage } from '../pages/home'
import { MoviePage } from '../pages/movie'
import { PopularPage } from '../pages/popular'
import { SearchPage } from '../pages/search'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/search', element: <SearchPage /> },
  { path: '/movie/:id', element: <MoviePage /> },
  { path: '/favorites', element: <FavoritesPage /> },
  { path: '/popular', element: <PopularPage /> },
])
