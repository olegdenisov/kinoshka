import { action, withAsync } from '@reatom/core'
import { apiClient, ApiError } from '@shared/api'
import { withQueryCache } from '@shared/lib'

import { mapDtoToMovieDetail } from '../api/mapDtoToMovieDetail'
import type { MovieDetail } from './types'

// Без wrap вокруг запроса: с ignoreAbort один промис делят все вызывающие, и отмена первого
// (смена набора id, уход со страницы) не должна ронять запрос остальным. Вызывающий сам
// оборачивает результат в wrap, а после await здесь атомы не читаются.
export const fetchMovieDetail = action(
  async (id: number): Promise<MovieDetail> => {
    const response = await apiClient.getV15MovieById({ path: { id } })

    if ('statusCode' in response.data) {
      // нужно чтобы сузить тип
      throw new ApiError(response.data.message, response.data.statusCode)
    }

    return mapDtoToMovieDetail(response.data)
  },
  'movie.fetchDetail',
).extend(withAsync(), withQueryCache({ length: 100, ignoreAbort: true }))
