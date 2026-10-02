import { apiClient, ApiError } from '@shared/api'
import { createQueryStore } from '@shared/lib'

import type { MovieDetail } from '../model/types'
import { mapDtoToMovieDetail } from './mapDtoToMovieDetail'

const fetchMovieDetail = async (id: number): Promise<MovieDetail> => {
  const response = await apiClient.getV15MovieById({ path: { id } })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return mapDtoToMovieDetail(response.data)
}

// Базовый стор «только detail по id»: его fetch() переиспользуют бандл фильма и getMoviesByIds —
// общий кеш, иначе квота demo-API тратится вдвое
export const movieDetailStore = createQueryStore({
  name: 'movieDetail',
  fetcher: fetchMovieDetail,
})
