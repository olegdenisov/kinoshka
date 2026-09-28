import { apiClient, ApiError } from '@shared/api'
import { createCachedFetcher } from '@shared/lib'

import type { PersonDetail } from '../model/types'
import { mapDtoToPersonDetail } from './mapDtoToPersonDetail'

const fetchPersonDetail = async (id: number): Promise<PersonDetail> => {
  const response = await apiClient.getV15PersonById({ path: { id } })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return mapDtoToPersonDetail(response.data)
}

export const getPersonDetail = createCachedFetcher<number, PersonDetail>(
  'person-detail',
  fetchPersonDetail,
)
