import { apiClient, baseApi, runQuery, unwrapErrorDto } from '@shared/api'
import type { QueryResult } from '@shared/api'

import {
  countryDictionaryCache,
  genreDictionaryCache,
} from './createDictionaryCache'
import type { DictionaryCache } from './createDictionaryCache'

// queryFn справочника: кулдаун проверяется здесь, а не в хуке — RTK Query сам перезапускает
// упавший запрос на новой подписке, и только queryFn видит каждую такую попытку.
const fetchDictionary = async (
  type: 'genres' | 'countries',
  cache: DictionaryCache,
): Promise<QueryResult<string[]>> => {
  if (!cache.tryStartAttempt()) {
    return { error: { message: 'Dictionary refresh is cooling down' } }
  }

  return runQuery(async () => {
    const response = await apiClient.getV15DictionaryByType({ path: { type } })
    return unwrapErrorDto(response.data).items.map(item => item.name)
  })
}

// Успешный ответ переживает перезагрузку через localStorage-слот; ошибка слот не трогает.
const persistDictionary =
  (cache: DictionaryCache) =>
  async (
    _arg: void,
    { queryFulfilled }: { queryFulfilled: Promise<{ data: string[] }> },
  ) => {
    try {
      const { data } = await queryFulfilled
      cache.save(data)
    } catch {
      // ошибка уже лежит в стейте запроса; существующий кеш остаётся как есть
    }
  }

export const dictionaryApi = baseApi.injectEndpoints({
  endpoints: build => ({
    getGenreDictionary: build.query<string[], void>({
      queryFn: () => fetchDictionary('genres', genreDictionaryCache),
      onQueryStarted: persistDictionary(genreDictionaryCache),
    }),
    getCountryDictionary: build.query<string[], void>({
      queryFn: () => fetchDictionary('countries', countryDictionaryCache),
      onQueryStarted: persistDictionary(countryDictionaryCache),
    }),
  }),
})

export const { useGetGenreDictionaryQuery, useGetCountryDictionaryQuery } =
  dictionaryApi
