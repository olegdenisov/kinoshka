import { use } from 'react'

import { getMovies } from '../api/getMovies'
import type { MovieType } from '../model/types'

export const useTopRatedMovies = (params?: { type: MovieType[] }) => {
  const result = use(
    getMovies({
      sortField: ['rating.kp'],
      'rating.kp': ['7-10'],
      sortType: ['-1'],
      type: params?.type,
    }),
  )

  return result
}
