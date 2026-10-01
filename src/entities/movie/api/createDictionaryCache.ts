import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

/**
 * Персистентная часть справочника (`/v1.5/dictionary/{type}`): localStorage-слот с отметкой
 * последней успешной загрузки и кулдаун повторных попыток. Сам запрос, in-flight-дедупликацию и
 * in-memory кеш даёт RTK Query (endpoints в movieApi.ts) — здесь только то, чего у него нет:
 * переживающий перезагрузку кеш на 7 дней и защита от частых повторов после неудачи.
 */
const dictionaryCacheSchema = z.object({
  items: z.array(z.string()),
  fetchedAt: z.number(),
})

const FALLBACK_VALUE = { items: [], fetchedAt: 0 }

export const DICTIONARY_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 дней
export const BACKGROUND_RETRY_COOLDOWN_MS = 60 * 1000 // 60 секунд

export const createDictionaryCache = (storageKey: string) => {
  const slot = createStorageSlot(
    storageKey,
    dictionaryCacheSchema,
    FALLBACK_VALUE,
  )

  // In-memory (не персистится специально — рестарт вкладки сбрасывает кулдаун, это приемлемо).
  // Нужен, потому что RTK Query перезапрашивает упавший запрос на каждой новой подписке —
  // без кулдауна каждый ремаунт селектора после ошибки бил бы в квоту.
  let lastAttemptAt = 0

  /** Свежий кеш — непустой и моложе TTL: запрос не нужен. */
  const isFresh = (): boolean => {
    const { items, fetchedAt } = slot.get()
    return items.length > 0 && Date.now() - fetchedAt <= DICTIONARY_TTL_MS
  }

  /**
   * Разрешает попытку и сразу отмечает её — `false`, если с прошлой попытки (успешной или нет)
   * не прошёл кулдаун.
   */
  const tryStartAttempt = (): boolean => {
    if (Date.now() - lastAttemptAt < BACKGROUND_RETRY_COOLDOWN_MS) {
      return false
    }
    lastAttemptAt = Date.now()
    return true
  }

  /** Пустой ответ не затирает кеш: иначе одна пустая выдача API стёрла бы список на 7 дней. */
  const save = (items: string[]): void => {
    if (items.length > 0) {
      slot.set({ items, fetchedAt: Date.now() })
    }
  }

  /** Тестовая утилита (глобальный `afterEach` в `src/test/setup.ts`): сбрасывает кулдаун. */
  const resetCooldown = (): void => {
    lastAttemptAt = 0
  }

  return { slot, isFresh, tryStartAttempt, save, resetCooldown }
}

export type DictionaryCache = ReturnType<typeof createDictionaryCache>

export const genreDictionaryCache = createDictionaryCache('kinoshka:genres')
export const countryDictionaryCache =
  createDictionaryCache('kinoshka:countries')

export const resetDictionaryCooldowns = (): void => {
  genreDictionaryCache.resetCooldown()
  countryDictionaryCache.resetCooldown()
}
