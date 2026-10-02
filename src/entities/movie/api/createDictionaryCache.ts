import {
  createPersistedStore,
  createStorageSlot,
  registerStoreReset,
} from '@shared/lib'
import { z } from 'zod'

/**
 * Фабрика кэша справочника (`/v1.5/dictionary/{type}`) — persisted-стор поверх прежнего
 * localStorage-слота: тот же ключ и тот же формат `{ items, fetchedAt }`, поэтому уже
 * сохранённые у пользователей справочники читаются. Никакого блокирующего TTL — пустой/устаревший
 * кэш всё равно синхронно отдаётся вызывающей стороне (см. useGenreDictionary.ts), протухание
 * лишь триггерит фоновое обновление. Кулдаун, in-flight дедупликация и защита от пустого ответа
 * живут только здесь — второй справочник получает их экземпляром, а не копией кода.
 */
const dictionaryCacheSchema = z.object({
  items: z.array(z.string()),
  fetchedAt: z.number(),
})

type DictionaryCacheState = z.infer<typeof dictionaryCacheSchema>

const FALLBACK_VALUE: DictionaryCacheState = { items: [], fetchedAt: 0 }

export const DICTIONARY_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 дней
export const BACKGROUND_RETRY_COOLDOWN_MS = 60 * 1000 // 60 секунд

type CreateDictionaryCacheOptions = {
  storageKey: string
  fetchItems: () => Promise<string[]>
}

export const createDictionaryCache = ({
  storageKey,
  fetchItems,
}: CreateDictionaryCacheOptions) => {
  const slot = createStorageSlot(
    storageKey,
    dictionaryCacheSchema,
    FALLBACK_VALUE,
  )

  const useStore = createPersistedStore<
    DictionaryCacheState,
    DictionaryCacheState
  >({
    name: storageKey,
    slot,
    select: ({ items, fetchedAt }) => ({ items, fetchedAt }),
    merge: (persisted, state) => ({ ...state, ...persisted }),
    creator: () => slot.get(),
  })

  // In-memory (не персистится специально — рестарт вкладки сбрасывает кулдаун, это приемлемо)
  // метка последней попытки + in-flight-промис для дедупликации. Живут в замыкании, поэтому
  // экземпляры (жанры, страны) не делят кулдаун друг с другом.
  let lastAttemptAt = 0
  let inFlight: Promise<void> | null = null
  // Поколение состояния: сброс его увеличивает, и запоздавший ответ запроса, стартовавшего до
  // сброса, не пишет в стор (иначе в тестах он протекает после localStorage.clear()).
  let generation = 0

  const isStale = (fetchedAt: number): boolean =>
    Date.now() - fetchedAt > DICTIONARY_TTL_MS

  /**
   * Фоновое (не блокирующее рендер) обновление. Если с последней попытки (успешной или нет)
   * прошло меньше `BACKGROUND_RETRY_COOLDOWN_MS` — no-op. `lastAttemptAt` ставится сразу при
   * старте попытки, а не только в `.catch`: иначе успешный ответ с `items: []` обновляет
   * `fetchedAt`, хук снова видит `items.length === 0` и без кулдауна тут же запускает новый фетч
   * (бесконечный цикл). Неудача существующий кэш не трогает.
   */
  const refresh = (): Promise<void> => {
    if (inFlight) {
      return inFlight
    }

    if (Date.now() - lastAttemptAt < BACKGROUND_RETRY_COOLDOWN_MS) {
      return Promise.resolve()
    }

    lastAttemptAt = Date.now()
    const startedIn = generation

    const attempt = fetchItems()
      .then(items => {
        if (startedIn !== generation) return
        // Пустой ответ не затирает уже загруженный справочник: жанров/стран не бывает ноль,
        // это заведомо неполные данные, и без проверки пользователь до следующего обновления
        // видел бы статический фолбэк вместо полного списка.
        if (items.length === 0 && useStore.getState().items.length > 0) return
        useStore.commit({ items, fetchedAt: Date.now() })
      })
      .catch(() => {
        // lastAttemptAt уже проставлен выше, до сетевого запроса
      })
      .finally(() => {
        if (inFlight === attempt) {
          inFlight = null
        }
      })
    inFlight = attempt

    return attempt
  }

  // Тестовый сброс (resetAllStores в src/test/setup.ts): сам стор перечитывает хранилище через
  // реестр createPersistedStore, здесь — только in-memory состояние замыкания.
  registerStoreReset(() => {
    generation += 1
    lastAttemptAt = 0
    inFlight = null
  })

  return { useStore, isStale, refresh }
}
