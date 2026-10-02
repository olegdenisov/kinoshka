import { useEffect } from 'react'

import {
  isCountryDictionaryStale,
  refreshCountryDictionary,
  useCountryDictionaryStore,
} from '../api/countryDictionaryCache'
import { STATIC_FALLBACK_COUNTRIES } from '../model/country'

/**
 * Синхронный хук по образцу useGenreDictionary (без `QueryBoundary`): сразу отдаёт кэш из
 * localStorage или STATIC_FALLBACK_COUNTRIES, устаревший/пустой кэш обновляется в фоне из
 * `useEffect`. Вызывается внутри CountrySelector, который монтируется только в раскрытой
 * группе, — запрос словаря уходит при первом раскрытии, а не на каждом заходе на /search.
 */
export const useCountryDictionary = (): string[] => {
  const items = useCountryDictionaryStore(s => s.items)
  const fetchedAt = useCountryDictionaryStore(s => s.fetchedAt)

  useEffect(() => {
    if (items.length === 0 || isCountryDictionaryStale(fetchedAt)) {
      void refreshCountryDictionary()
    }
  }, [items, fetchedAt])

  return items.length === 0 ? STATIC_FALLBACK_COUNTRIES : items
}
