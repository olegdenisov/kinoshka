import { apiClient, ApiError } from '@shared/api'

import type { Genre } from '../model/genre'

export const getGenreDictionary = async (): Promise<Genre[]> => {
  const response = await apiClient.getV15DictionaryByType({
    path: { type: 'genres' },
  })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return response.data.items.map(item => ({ name: item.name }))
}
