import { apiClient, ApiError } from '@shared/api'

export const getCountryDictionary = async (): Promise<string[]> => {
  const response = await apiClient.getV15DictionaryByType({
    path: { type: 'countries' },
  })

  if ('statusCode' in response.data) {
    // нужно чтобы сузить тип
    throw new ApiError(response.data.message, response.data.statusCode)
  }

  return response.data.items.map(item => item.name)
}
