export type SessionCacheEntry<T> = {
  data: T
  timestamp: number
  isError: boolean
  message?: string
}

export type SessionCache<T> = {
  get: (key: string) => SessionCacheEntry<T> | undefined
  set: (key: string, entry: SessionCacheEntry<T>) => void
  remove: (key: string) => void
}

export const createSessionCache = <T>(namespace: string): SessionCache<T> => {
  const storageKey = (key: string) => `kinoshka:${namespace}:${key}`

  return {
    get(key) {
      if (!import.meta.env.DEV) {
        return undefined
      }

      try {
        const raw = sessionStorage.getItem(storageKey(key))

        return raw ? (JSON.parse(raw) as SessionCacheEntry<T>) : undefined
      } catch {
        return undefined
      }
    },
    set(key, entry) {
      if (!import.meta.env.DEV) {
        return
      }

      try {
        sessionStorage.setItem(storageKey(key), JSON.stringify(entry))
      } catch {
        // quota exceeded / private mode — просто не персистим, in-memory кэш продолжает работать
      }
    },
    remove(key) {
      if (!import.meta.env.DEV) {
        return
      }

      try {
        sessionStorage.removeItem(storageKey(key))
      } catch {
        // private mode и т.п. — просто не персистим, in-memory кэш продолжает работать
      }
    },
  }
}
