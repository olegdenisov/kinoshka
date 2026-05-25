import { createBrowserRouter } from 'react-router'
import { HomePage } from '../pages/home'
import { SearchPage } from '../pages/search'
import { MoviePage } from '../pages/movie'

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/search', element: <SearchPage /> },
  { path: '/movie/:id', element: <MoviePage /> },
])
