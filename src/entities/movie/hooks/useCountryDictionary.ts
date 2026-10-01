import { countryDictionaryCache } from '../api/createDictionaryCache'
import { useGetCountryDictionaryQuery } from '../api/movieApi'
import { STATIC_FALLBACK_COUNTRIES } from '../model/country'

/**
 * Синхронный хук по образцу useGenreDictionary. Вызывается внутри CountrySelector, который
 * монтируется только в раскрытой группе, — запрос словаря уходит при первом раскрытии, а не на
 * каждом заходе на /search.
 */
export const useCountryDictionary = (): string[] => {
  const { data } = useGetCountryDictionaryQuery(undefined, {
    skip: countryDictionaryCache.isFresh(),
  })
  const items = data?.length ? data : countryDictionaryCache.slot.get().items

  return items.length === 0 ? STATIC_FALLBACK_COUNTRIES : items
}
