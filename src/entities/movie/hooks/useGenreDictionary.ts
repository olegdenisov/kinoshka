import { useEffect } from 'react'

import {
  isGenreDictionaryStale,
  refreshGenreDictionary,
  useGenreDictionaryStore,
} from '../api/genreDictionaryCache'
import type { Genre } from '../model/genre'
import { STATIC_FALLBACK_GENRES } from '../model/genre'

/**
 * Обычный синхронный хук (без `QueryBoundary`) — компонент, вызывающий его, всегда рендерится
 * сразу: либо закэшированным в localStorage списком, либо статическим фолбэком
 * `STATIC_FALLBACK_GENRES`. Устаревший/пустой кэш триггерит фоновое обновление из `useEffect`
 * (побочный эффект не должен жить в фазе рендера); успешное обновление стора реактивно долетает
 * через подписку, компонент перерисуется с полным списком из API.
 */
export const useGenreDictionary = (): Genre[] => {
  const items = useGenreDictionaryStore(state => state.items)
  const fetchedAt = useGenreDictionaryStore(state => state.fetchedAt)

  useEffect(() => {
    if (items.length === 0 || isGenreDictionaryStale(fetchedAt)) {
      void refreshGenreDictionary()
    }
  }, [items, fetchedAt])

  if (items.length === 0) {
    return STATIC_FALLBACK_GENRES
  }

  return items.map(name => ({ name }))
}
