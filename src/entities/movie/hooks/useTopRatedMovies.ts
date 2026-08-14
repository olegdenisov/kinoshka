import { use } from 'react'

import { getMovies } from '../api/getMovies'
import type { MovieType } from '../model/types'

const buildTopRatedParams = (params?: {
  type: MovieType[]
}): Parameters<typeof getMovies>[0] => ({
  sortField: ['rating.kp'],
  'rating.kp': ['7-10'],
  sortType: ['-1'],
  type: params?.type,
})

export const useTopRatedMovies = (params?: { type: MovieType[] }) => {
  const result = use(getMovies(buildTopRatedParams(params)))

  return result
}

/** Companion-инвалидация для Retry: те же params, что и у хука выше. */
export const invalidateTopRatedMovies = (params?: { type: MovieType[] }) =>
  getMovies.invalidate(buildTopRatedParams(params))
