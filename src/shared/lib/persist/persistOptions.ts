import type { z } from 'zod'

// Number.MAX_SAFE_INTEGER, а не дефолт: в @reatom/core 1001.3.0 дефолт `time` — ~24,8 дня,
// запись с истёкшим `to` удаляется при чтении. Infinity нельзя — сериализуется в null.
export const PERSIST_FOREVER_MS = Number.MAX_SAFE_INTEGER

type PersistOptionsInput<State, Stored> = {
  key: string
  // Описывает формат в хранилище (для Set — массив), а не состояние атома.
  schema: z.ZodType<Stored>
  fallback: State
  fromValid?: (stored: Stored) => State
  toSnapshot?: (state: State) => Stored
}

// Валидация через safeParse в fromSnapshot, а не через опцию `schema` Reatom: та при невалидных
// данных бросает TypeError из чтения атома, а нам нужен тихий дефолт.
export const persistOptions = <State, Stored = State>({
  key,
  schema,
  fallback,
  fromValid,
  toSnapshot,
}: PersistOptionsInput<State, Stored>) => ({
  key,
  time: PERSIST_FOREVER_MS,
  fromSnapshot: (snapshot: unknown): State => {
    const parsed = schema.safeParse(snapshot)
    if (!parsed.success) return fallback
    return fromValid
      ? fromValid(parsed.data)
      : (parsed.data as unknown as State)
  },
  ...(toSnapshot ? { toSnapshot } : {}),
})
