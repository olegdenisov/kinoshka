import { action, withAsync } from '@reatom/core'
import { apiClient, ApiError } from '@shared/api'
import { withQueryCache } from '@shared/lib'

import { mapDtoToPersonDetail } from '../api/mapDtoToPersonDetail'
import type { PersonDetail } from './types'

// Без wrap вокруг запроса — по той же причине, что у fetchMovieDetail.
export const fetchPersonDetail = action(
  async (id: number): Promise<PersonDetail> => {
    const response = await apiClient.getV15PersonById({ path: { id } })

    if ('statusCode' in response.data) {
      // нужно чтобы сузить тип
      throw new ApiError(response.data.message, response.data.statusCode)
    }

    return mapDtoToPersonDetail(response.data)
  },
  'person.fetchDetail',
).extend(withAsync(), withQueryCache({ length: 50, ignoreAbort: true }))
