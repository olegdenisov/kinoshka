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
  return {
    get() {
      try {
        const raw = localStorage.getItem(key)
        if (raw === null) {
          return fallback
        }
        const parsed = schema.safeParse(JSON.parse(raw))

        return parsed.success ? parsed.data : fallback
      } catch {
        return fallback
      }
    },
    remove() {
      localStorage.removeItem(key)
    },
    set(value: T) {
      localStorage.setItem(key, JSON.stringify(value))
      emitter.dispatchEvent(new Event('change')) // уведомляем текущую вкладку
    },
    subscribe(callback) {
      const localHandler = () => callback()
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
