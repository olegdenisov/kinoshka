import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

/**
 * Фабрика localStorage-кэша справочника (`/v1.5/dictionary/{type}`). Хранит названия как есть
 * плюс отметку времени последней успешной загрузки. Никакого блокирующего TTL — пустой/устаревший
 * кэш всё равно синхронно отдаётся вызывающей стороне (см. useGenreDictionary.ts), протухание
 * лишь триггерит фоновое обновление. Кулдаун, in-flight дедупликация и защита от пустого ответа
 * живут только здесь — второй справочник получает их экземпляром, а не копией кода.
 */
const dictionaryCacheSchema = z.object({
  items: z.array(z.string()),
  fetchedAt: z.number(),
})

type DictionaryCacheValue = z.infer<typeof dictionaryCacheSchema>

const FALLBACK_VALUE: DictionaryCacheValue = { items: [], fetchedAt: 0 }

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
  // Слот создаётся один раз на экземпляр: get() мемоизирует распарсенное значение, а
  // useStorageSlot передаёт его в useSyncExternalStore как getSnapshot — нужна стабильная ссылка.
  const slot = createStorageSlot(
    storageKey,
    dictionaryCacheSchema,
    FALLBACK_VALUE,
  )

  // In-memory (не персистится специально — рестарт вкладки сбрасывает кулдаун, это приемлемо)
  // метка последней попытки + in-flight-промис для дедупликации. Живут в замыкании, поэтому
  // экземпляры (жанры, страны) не делят кулдаун друг с другом.
  let lastAttemptAt = 0
  let inFlight: Promise<void> | null = null
  // Поколение состояния: resetState/invalidate его увеличивают, и запоздавший ответ запроса,
  // стартовавшего до сброса, не пишет в слот (иначе в тестах он протекает после
  // localStorage.clear(), а после invalidate перезаписывает свежий кэш старым ответом).
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
        if (startedIn === generation) {
          slot.set({ items, fetchedAt: Date.now() })
        }
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

  /**
   * Тестовая утилита (глобальный `afterEach` в `src/test/setup.ts`): сбрасывает in-memory
   * состояние экземпляра без доступа к замыканию. localStorage чистится отдельно.
   */
  const resetState = (): void => {
    generation += 1
    lastAttemptAt = 0
    inFlight = null
  }

  /** Ручной форс-рефреш: чистит слот и сбрасывает кулдаун/in-flight. */
  const invalidate = (): void => {
    slot.remove()
    resetState()
  }

  return { slot, isStale, refresh, invalidate, resetState }
}
