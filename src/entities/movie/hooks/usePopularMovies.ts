import { use } from 'react'

import { getPopularMovies } from '../api/getPopularMovies'

const POPULAR_PARAMS = { slug: 'popular', limit: 10 }

export const usePopularMovies = () => {
  const result = use(getPopularMovies(POPULAR_PARAMS))

  return result
}

/** Companion-инвалидация для Retry: те же params, что и у хука выше. */
export const invalidatePopularMovies = () =>
  getPopularMovies.invalidate(POPULAR_PARAMS)
