import { useStorageSlot } from '@shared/lib'
import { useEffect } from 'react'

import {
  genreDictionarySlot,
  isGenreDictionaryStale,
  refreshGenreDictionary,
} from '../api/genreDictionaryCache'
import type { Genre } from '../model/genre'
import { STATIC_FALLBACK_GENRES } from '../model/genre'

/**
 * Обычный синхронный хук (никакого Suspense/`use()`/`AsyncBoundary`) — компонент,
 * вызывающий его, всегда рендерится сразу: либо закэшированным в localStorage списком,
 * либо статическим фолбэком `STATIC_FALLBACK_GENRES`. Устаревший/пустой кэш триггерит
 * фоновое обновление из `useEffect` (побочный эффект не должен жить в фазе рендера);
 * успешное обновление слота реактивно долетает через `useStorageSlot`
 * (`useSyncExternalStore`), компонент перерисуется с полным списком из API.
 */
export const useGenreDictionary = (): Genre[] => {
  const [{ items, fetchedAt }] = useStorageSlot(genreDictionarySlot)

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

export { invalidateGenreDictionary } from '../api/genreDictionaryCache'
