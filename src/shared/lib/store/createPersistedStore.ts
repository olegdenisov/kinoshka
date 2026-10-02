import {
  create,
  type Mutate,
  type StateCreator,
  type StoreApi,
  type UseBoundStore,
} from 'zustand'
import { devtools, persist, type PersistStorage } from 'zustand/middleware'

import type { StorageSlot } from '../storage'
import { registerStoreReset } from './registry'

type PartialState<TState> =
  | Partial<TState>
  | ((state: TState) => Partial<TState>)

// Применяет апдейт и сообщает, удалась ли запись в хранилище. false — стор уже возвращён к
// содержимому хранилища: UI не показывает значение, которое не сохранилось.
export type Commit<TState> = (partial: PartialState<TState>) => boolean

type PersistedStoreApi<TState, TPersisted> = Mutate<
  StoreApi<TState>,
  [['zustand/persist', TPersisted]]
>

export type PersistedStore<TState, TPersisted> = UseBoundStore<
  PersistedStoreApi<TState, TPersisted>
> & { commit: Commit<TState> }

type PersistedStoreOptions<TState, TPersisted> = {
  // имя для devtools; пользовательский ввод сюда не попадает
  name: string
  slot: StorageSlot<TPersisted>
  // что пишем в хранилище (partialize)
  select: (state: TState) => TPersisted
  // как кладём прочитанное в стейт. Обязателен: дефолтный spread-merge persist для массива
  // или строки дал бы мусор вида { 0: 1, 1: 2, ...state }
  merge: (persisted: TPersisted, state: TState) => TState
  creator: (commit: Commit<TState>, get: () => TState) => TState
}

export const createPersistedStore = <TState, TPersisted>({
  name,
  slot,
  select,
  merge,
  creator,
}: PersistedStoreOptions<TState, TPersisted>): PersistedStore<
  TState,
  TPersisted
> => {
  let lastWriteOk = true
  // Слот уведомляет подписчиков синхронно внутри собственного slot.set() — флаг отличает своё
  // уведомление от записи другой вкладки. Сравнивать значение по ссылке нельзя: set() сбрасывает
  // мемо слота, и следующий get() для массива/объекта вернёт новую ссылку.
  let isOwnWrite = false

  // Адаптер поверх слота вместо createJSONStorage: в хранилище уходит голое значение без
  // envelope { state, version } — тот же формат, что на main (инлайн-скрипт темы в index.html
  // читает kinoshka:theme как голый JSON, а сохранённые данные пользователей не теряются).
  // Валидация zod и репорт сбоев в Sentry остаются в слоте.
  const storage: PersistStorage<TPersisted, boolean> = {
    // version совпадает с дефолтной version persist (0) — при несовпадении без migrate persist
    // молча отбросил бы прочитанное
    getItem: () => ({ state: slot.get(), version: 0 }),
    setItem: (_name, { state }) => {
      isOwnWrite = true
      try {
        lastWriteOk = slot.set(state)
      } finally {
        isOwnWrite = false
      }

      return lastWriteOk
    },
    // remove() у слота сбой не сообщает (молча репортит в Sentry) — результата нет
    removeItem: () => {
      slot.remove()

      return true
    },
  }

  let store: PersistedStore<TState, TPersisted> | undefined

  const commit: Commit<TState> = partial => {
    if (!store) throw new Error(`[${name}] commit до создания стора`)
    store.setState(partial)
    if (lastWriteOk) return true
    // rehydrate() кладёт прочитанное через исходный set, минуя обёртку persist, — обратно в
    // хранилище ничего не пишет (проверено по исходникам zustand 5.0.15)
    store.persist.rehydrate()

    return false
  }

  const initializer: StateCreator<
    TState,
    [],
    [['zustand/persist', TPersisted]]
  > = persist((_set, get) => creator(commit, get), {
    name,
    storage,
    partialize: select,
    // persisted === undefined только при отброшенной версии — с адаптером выше не случается,
    // но тип persist это допускает
    merge: (persisted, current) =>
      persisted === undefined
        ? current
        : merge(persisted as TPersisted, current),
  })

  // devtools только в DEV: в прод-сборке ветка вырезается вместе с middleware
  const useStore = import.meta.env.DEV
    ? create<TState>()(
        devtools(initializer, { name }) as unknown as typeof initializer,
      )
    : create<TState>()(initializer)

  store = Object.assign(useStore, { commit })

  // Синхронизация вкладок. Гидрация синхронная (слот синхронный), поэтому первый рендер уже
  // с данными хранилища.
  slot.subscribe(() => {
    if (!isOwnWrite) void store?.persist.rehydrate()
  })

  // В тестах localStorage очищается перед сбросом — стор перечитывает хранилище
  registerStoreReset(() => {
    void store?.persist.rehydrate()
  })

  return store
}
