import type { z } from 'zod'

export type StorageSlot<T> = {
  get: () => T
  set: (value: T) => void
  remove: () => void
  subscribe: (callback: () => void) => () => void // возвращает unsubscribe
}

const emitter = new EventTarget()

export const createStorageSlot = <T>(
  key: string,
  schema: z.ZodType<T>,
  fallback: T,
): StorageSlot<T> => {
  // Мемо распарсенного значения по сырой строке из localStorage: get() —
  // getSnapshot для useSyncExternalStore, который требует референциальной
  // стабильности между вызовами без изменений в сторе (иначе React считает
  // снапшот каждый раз новым → бесконечный ре-рендер + dev-варнинг).
  let cachedRaw: string | null = null
  let cachedValue: T = fallback
  let hasCached = false

  return {
    get() {
      const raw = localStorage.getItem(key)
      if (raw === null) {
        cachedRaw = null
        hasCached = false
        return fallback
      }
      if (hasCached && raw === cachedRaw) {
        return cachedValue
      }
      try {
        const parsed = schema.safeParse(JSON.parse(raw))
        cachedValue = parsed.success ? parsed.data : fallback
      } catch {
        cachedValue = fallback
      }
      cachedRaw = raw
      hasCached = true

      return cachedValue
    },
    remove() {
      localStorage.removeItem(key)
      cachedRaw = null
      hasCached = false
    },
    set(value: T) {
      localStorage.setItem(key, JSON.stringify(value))
      cachedRaw = null
      hasCached = false
      // Уведомляем текущую вкладку. emitter — один общий EventTarget на все слоты (см.
      // модульную переменную выше), поэтому событие несёт key в detail — иначе set() на
      // одном слоте будил бы подписчиков всех остальных слотов в том же таб (лишние
      // ре-рендеры/срабатывания useSyncExternalStore на несвязанных ключах).
      emitter.dispatchEvent(new CustomEvent('change', { detail: { key } }))
    },
    subscribe(callback) {
      const localHandler = (e: Event) => {
        if ((e as CustomEvent<{ key: string }>).detail.key === key) callback()
      }
      const storageHandler = (e: StorageEvent) => {
        if (e.key === key) callback()
      }

      window.addEventListener('storage', storageHandler)
      emitter.addEventListener('change', localHandler)

      return () => {
        window.removeEventListener('storage', storageHandler)
        emitter.removeEventListener('change', localHandler)
      }
    },
  }
}
