import { createDictionaryCache } from './createDictionaryCache'
import { getCountryDictionary } from './getCountryDictionary'

// Отдельного invalidate для стран наружу нет: ручного форс-рефреша у справочника стран нет
// ни у одного потребителя.
const countryDictionaryCache = createDictionaryCache({
  storageKey: 'kinoshka:countries',
  fetchItems: getCountryDictionary,
})

export const countryDictionarySlot = countryDictionaryCache.slot
export const isCountryDictionaryStale = countryDictionaryCache.isStale
export const refreshCountryDictionary = countryDictionaryCache.refresh
export const resetCountryDictionaryState = countryDictionaryCache.resetState
