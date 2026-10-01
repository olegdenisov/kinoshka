import { apiClient, ApiError, baseApi, toQueryError } from '@shared/api'

import type { PersonDetail } from '../model/types'
import { mapDtoToPersonDetail } from './mapDtoToPersonDetail'

export const personApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getPersonDetail: build.query<PersonDetail, number>({
      queryFn: async id => {
        try {
          const response = await apiClient.getV15PersonById({ path: { id } })

          if ('statusCode' in response.data) {
            // нужно чтобы сузить тип; status сохраняем — по нему 404-вью
            throw new ApiError(response.data.message, response.data.statusCode)
          }

          return { data: mapDtoToPersonDetail(response.data) }
        } catch (error) {
          return { error: toQueryError(error) }
        }
      },
    }),
  }),
})

export const { useGetPersonDetailQuery } = personApi
