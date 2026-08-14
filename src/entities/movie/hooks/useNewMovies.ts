import { use } from 'react'

import { getMovies } from '../api/getMovies'
import type { MovieType } from '../model/types'

const buildNewMoviesParams = (params?: {
  type: MovieType[]
}): Parameters<typeof getMovies>[0] => ({
  ...params,
  year: [new Date().getFullYear().toString()],
})

export const useNewMovies = (params?: { type: MovieType[] }) => {
  const result = use(getMovies(buildNewMoviesParams(params)))

  return result
}

/** Companion-инвалидация для Retry: те же params, что и у хука выше. */
export const invalidateNewMovies = (params?: { type: MovieType[] }) =>
  getMovies.invalidate(buildNewMoviesParams(params))
