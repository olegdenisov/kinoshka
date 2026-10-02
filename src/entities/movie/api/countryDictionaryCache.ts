import { createDictionaryCache } from './createDictionaryCache'
import { getCountryDictionary } from './getCountryDictionary'

const countryDictionaryCache = createDictionaryCache({
  storageKey: 'kinoshka:countries',
  fetchItems: getCountryDictionary,
})

export const useCountryDictionaryStore = countryDictionaryCache.useStore
export const isCountryDictionaryStale = countryDictionaryCache.isStale
export const refreshCountryDictionary = countryDictionaryCache.refresh
