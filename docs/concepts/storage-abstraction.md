# Абстракция над localStorage (`createStorageSlot`)

## Зачем это вообще нужно

Голый `localStorage` — это сырой key/value store без типов, без валидации и без реактивности. При прямом использовании в нескольких местах приложения возникают классические проблемы:

**1. Несовпадение схем при деплое.** Пользователь сохранил `{ ids: [1, 2, 3] }` в старой версии приложения. Вышел деплой, где структура поменялась на `{ movieIds: number[], addedAt: string[] }`. При чтении приложение получит невалидные данные и молча сломается или упадёт.

**2. Нет типов.** `localStorage.getItem('favorites')` возвращает `string | null`. Каждый раз нужно парсить JSON, проверять на null, кастить тип — это бойлерплейт.

**3. Компоненты не реагируют на изменения.** Если одна вкладка изменила favorites, другая об этом не узнает — `useState` не подписан на `storage` event.

**4. Рассыпанные ключи.** `'favorites'`, `'theme'`, `'filters'` живут в разных местах без единого реестра — легко опечататься, легко конфликтовать.

---

## Как реализуется

```ts
// src/shared/lib/storage.ts
import { z } from 'zod'

type StorageSlot<T> = {
  get(): T
  set(value: T): void
  remove(): void
  subscribe(callback: () => void): () => void // возвращает unsubscribe
}

function createStorageSlot<T>(key: string, schema: z.ZodType<T>, fallback: T): StorageSlot<T> {
  return {
    get() {
      try {
        const raw = localStorage.getItem(key)
        if (raw === null) return fallback
        const parsed = schema.safeParse(JSON.parse(raw))
        return parsed.success ? parsed.data : fallback // невалидное → fallback
      } catch {
        return fallback // невалидный JSON → fallback
      }
    },
    set(value) {
      localStorage.setItem(key, JSON.stringify(value))
    },
    remove() {
      localStorage.removeItem(key)
    },
    subscribe(callback) {
      // storage event срабатывает только в других вкладках
      const handler = (e: StorageEvent) => {
        if (e.key === key) callback()
      }
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  }
}
```

**Определение конкретных слотов:**

```ts
// src/features/favorites/model/storage.ts
const favoritesSchema = z.object({ ids: z.array(z.number()) })

export const favoritesSlot = createStorageSlot('favorites', favoritesSchema, {
  ids: [],
})
```

**Подключение к React через `useSyncExternalStore`:**

```ts
// src/features/favorites/model/useFavorites.ts
import { useSyncExternalStore } from 'react'
import { favoritesSlot } from './storage'

export function useFavorites() {
  const data = useSyncExternalStore(
    favoritesSlot.subscribe, // подписка на изменения
    favoritesSlot.get, // чтение текущего значения
    () => ({ ids: [] }), // SSR-fallback (для будущего Phase 4)
  )

  const toggle = (id: number) => {
    const ids = data.ids.includes(id) ? data.ids.filter(x => x !== id) : [...data.ids, id]
    favoritesSlot.set({ ids })
    // ⚠ useSyncExternalStore НЕ реагирует на изменения в той же вкладке!
    // Нужно уведомить вручную — об этом ниже
  }

  return { ids: data.ids, toggle }
}
```

**Нюанс с той же вкладкой.** `storage` event от `window` приходит только в _других_ вкладках, не в текущей. Для синка в текущей вкладке нужен кастомный EventEmitter или `BroadcastChannel`:

```ts
// В createStorageSlot:
const emitter = new EventTarget()

set(value) {
  localStorage.setItem(key, JSON.stringify(value))
  emitter.dispatchEvent(new Event('change'))  // уведомляем текущую вкладку
},
subscribe(callback) {
  const localHandler = () => callback()
  const storageHandler = (e: StorageEvent) => { if (e.key === key) callback() }

  emitter.addEventListener('change', localHandler)
  window.addEventListener('storage', storageHandler)

  return () => {
    emitter.removeEventListener('change', localHandler)
    window.removeEventListener('storage', storageHandler)
  }
}
```

---

## Преимущества

|                            |                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| **Типобезопасность**       | Zod-схема — единственный источник типа; TypeScript видит `T` напрямую                             |
| **Защита от schema drift** | Невалидные данные → fallback, а не crash                                                          |
| **Реактивность**           | `useSyncExternalStore` — официальный React API для внешних store; cross-tab sync бесплатно        |
| **Единый реестр**          | Все ключи в одном месте, нет опечаток, нет конфликтов                                             |
| **Тестируемость**          | `createStorageSlot` — чистая функция, легко мокать через `vi.spyOn(Storage.prototype, 'getItem')` |
| **SSR-ready**              | `getServerSnapshot` в `useSyncExternalStore` = fallback при отсутствии window                     |

## Недостатки

|                                           |                                                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Zod как зависимость**                   | Добавляет ~13 KB к бандлу (но он и так нужен в проекте для валидации форм/API)                  |
| **Синхронный localStorage**               | Блокирует main thread на крупных данных (не актуально для массива ID)                           |
| **Не реактивный на set в той же вкладке** | Нужен дополнительный EventEmitter/BroadcastChannel — небольшой overhead                         |
| **Нет миграций**                          | Если схема меняется принципиально, fallback просто затирает старые данные — нет версионирования |

---

## Как используется в фазах

- **Phase 2.1 (Favorites)** — `favoritesSlot` хранит `{ ids: number[] }`, `useFavorites()` читает через него
- **Phase 2.2 (Theme)** — `themeSlot` хранит `'light' | 'dark' | 'system'`
- **Phase 3 (State libs)** — в Zustand/Jotai слоты заменяются на встроенные `persist` middleware, но интерфейс тот же
- **Phase 5 (Auth/BFF)** — favorites переезжают на сервер, слот остаётся как guest-хранилище до логина

---

## Ключевая идея

Один вызов `createStorageSlot` заменяет весь бойлерплейт — парсинг JSON, null-check, типизацию, валидацию при init, cross-tab синк — в каждом месте использования.
