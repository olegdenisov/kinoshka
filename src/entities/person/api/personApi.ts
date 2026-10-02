import { apiClient, baseApi, runQuery, unwrapErrorDto } from '@shared/api'

import type { PersonDetail } from '../model/types'
import { mapDtoToPersonDetail } from './mapDtoToPersonDetail'

export const personApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getPersonDetail: build.query<PersonDetail, number>({
      // status error-DTO сохраняется в QueryError — по нему 404-вью
      queryFn: id =>
        runQuery(async () => {
          const response = await apiClient.getV15PersonById({ path: { id } })
          return mapDtoToPersonDetail(unwrapErrorDto(response.data))
        }),
    }),
  }),
})

export const { useGetPersonDetailQuery } = personApi
