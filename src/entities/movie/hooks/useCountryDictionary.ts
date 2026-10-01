import { useStorageSlot } from '@shared/lib'
import { useEffect } from 'react'

import {
  countryDictionarySlot,
  isCountryDictionaryStale,
  refreshCountryDictionary,
} from '../api/countryDictionaryCache'
import { STATIC_FALLBACK_COUNTRIES } from '../model/country'

/**
 * Синхронный хук по образцу useGenreDictionary (без Suspense/`AsyncBoundary`): сразу отдаёт
 * кэш из localStorage или STATIC_FALLBACK_COUNTRIES, устаревший/пустой кэш обновляется в фоне
 * из `useEffect`. Вызывается внутри CountrySelector, который монтируется только в раскрытой
 * группе, — запрос словаря уходит при первом раскрытии, а не на каждом заходе на /search.
 */
export const useCountryDictionary = (): string[] => {
  const [{ items, fetchedAt }] = useStorageSlot(countryDictionarySlot)

  useEffect(() => {
    if (items.length === 0 || isCountryDictionaryStale(fetchedAt)) {
      void refreshCountryDictionary()
    }
  }, [items, fetchedAt])

  return items.length === 0 ? STATIC_FALLBACK_COUNTRIES : items
}
