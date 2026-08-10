import { createBrowserRouter } from 'react-router'

import { HomePage } from '../pages/home'
import { MoviePage } from '../pages/movie'
import { SearchPage } from '../pages/search'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/search', element: <SearchPage /> },
  { path: '/movie/:id', element: <MoviePage /> },
])
