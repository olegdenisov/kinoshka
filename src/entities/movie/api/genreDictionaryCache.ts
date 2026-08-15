import { createStorageSlot } from '@shared/lib'
import { z } from 'zod'

import { getGenreDictionary } from './getGenreDictionary'

/**
 * localStorage-кэш справочника жанров. Хранит русские названия как есть (канонический
 * жанр из плана docs/plans/20260815-dynamic-genre-dictionary.md) плюс отметку времени
 * последней успешной загрузки. Никакого блокирующего TTL — пустой/устаревший кэш всё
 * равно синхронно отдаётся вызывающей стороне (см. useGenreDictionary.ts), протухание
 * лишь триггерит фоновое обновление.
 */
const genreDictionarySchema = z.object({
  items: z.array(z.string()),
  fetchedAt: z.number(),
})

export type GenreDictionaryCacheValue = z.infer<typeof genreDictionarySchema>

const FALLBACK_VALUE: GenreDictionaryCacheValue = { items: [], fetchedAt: 0 }

export const GENRE_DICTIONARY_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 дней
export const BACKGROUND_RETRY_COOLDOWN_MS = 60 * 1000 // 60 секунд

// Фикс референциальной стабильности createStorageSlot.get() из Task 1 — обязателен здесь,
// потому что genreDictionarySlot.get передаётся в useSyncExternalStore как getSnapshot
// (через useStorageSlot), а значение — объект/массив.
export const genreDictionarySlot = createStorageSlot(
  'kinoshka:genres',
  genreDictionarySchema,
  FALLBACK_VALUE,
)

export const isGenreDictionaryStale = (fetchedAt: number): boolean =>
  Date.now() - fetchedAt > GENRE_DICTIONARY_TTL_MS

// In-memory (не персистится специально — рестарт вкладки/страницы сбрасывает кулдаун,
// это приемлемо, см. Technical Details плана) метка последней НЕУДАЧНОЙ попытки фонового
// обновления + module-level in-flight-промис для дедупликации параллельных вызовов.
let lastAttemptAt = 0
let inFlight: Promise<void> | null = null

/**
 * Фоновое (не блокирующее рендер) обновление справочника жанров. Дедуплицирует параллельные
 * вызовы через `inFlight`. Если с последней неудачной попытки прошло меньше
 * `BACKGROUND_RETRY_COOLDOWN_MS` — no-op, сетевой запрос не уходит (защита от эндпоинта,
 * стабильно отдающего 403/500). Успех пишет `{ items, fetchedAt }` в localStorage-слот
 * (реактивно долетает до подписчиков useStorageSlot); неудача обновляет только in-memory
 * `lastAttemptAt`, существующий кэш не трогает.
 */
export const refreshGenreDictionary = (): Promise<void> => {
  if (inFlight) {
    return inFlight
  }

  if (Date.now() - lastAttemptAt < BACKGROUND_RETRY_COOLDOWN_MS) {
    return Promise.resolve()
  }

  inFlight = getGenreDictionary()
    .then(genres => {
      genreDictionarySlot.set({
        items: genres.map(genre => genre.name),
        fetchedAt: Date.now(),
      })
    })
    .catch(() => {
      lastAttemptAt = Date.now()
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

/** Ручной форс-рефреш: чистит слот и сбрасывает in-memory состояние (кулдаун/in-flight). */
export const invalidateGenreDictionary = (): void => {
  genreDictionarySlot.remove()
  lastAttemptAt = 0
  inFlight = null
}

/**
 * Тестовая утилита (см. `src/test/setup.ts`, вызывается в глобальном `afterEach` по аналогии
 * с `resetAllCachedFetchers`): сбрасывает in-memory состояние модуля (кулдаун/in-flight) без
 * прямого доступа к замыканию. localStorage чистится отдельно (`localStorage.clear()`).
 */
export const resetGenreDictionaryState = (): void => {
  lastAttemptAt = 0
  inFlight = null
}
