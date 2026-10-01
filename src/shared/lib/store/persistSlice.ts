import type { PayloadActionCreator, UnknownAction } from '@reduxjs/toolkit'

import type { StorageSlot } from '../storage/storage'
import type { StartListening } from './listenerMiddleware'

type PersistSliceOptions<State, T> = {
  startListening: StartListening<State>
  slot: StorageSlot<T>
  select: (state: State) => T
  // Экшены, после которых значение пишется в слот. hydrated сюда включать нельзя: он приносит
  // значение, которое уже лежит в слоте (из другой вкладки), запись обратно была бы лишней.
  matcher: (action: UnknownAction) => boolean
  // Откат к значению до экшена при отказе записи. Исключается из matcher автоматически — иначе
  // откат сам попытался бы записать (и, при недоступном хранилище, снова откатиться).
  rollback: PayloadActionCreator<T>
}

// Дженерик по форме стейта: shared не знает RootState, фича описывает только свой срез.
// Возвращает unsubscribe listener'а.
export const persistSlice = <State, T>({
  startListening,
  slot,
  select,
  matcher,
  rollback,
}: PersistSliceOptions<State, T>) =>
  startListening({
    predicate: action => !rollback.match(action) && matcher(action),
    // Эффект listener'а вызывается синхронно внутри dispatch (сразу после редьюсера, до первого
    // await), поэтому к возврату из dispatch стейт уже либо записан в слот, либо откатан — на этом
    // держится boolean-результат вызывающих (useProfile().setName сравнивает стейт после dispatch).
    // getOriginalState() доступен только в этой синхронной части — не переносить его за await.
    effect: (_action, api) => {
      if (slot.set(select(api.getState()))) return
      api.dispatch(rollback(select(api.getOriginalState())))
    },
  })

type SubscribableStore<State> = {
  getState: () => State
  dispatch: (action: UnknownAction) => unknown
}

type SubscribeSlotOptions<State, T> = {
  select: (state: State) => T
  hydrated: PayloadActionCreator<T>
}

// Слот хранит JSON, а slot.get() отдаёт свежераспарсенный объект — сравнение по ссылке всегда
// давало бы «изменилось». Сравниваем сериализованные формы, как они лежат в localStorage.
const isSameValue = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b)

// Вкладка → стор: изменения слота из другой вкладки (storage-событие) приходят как hydrated.
// slot.subscribe срабатывает и на set() своей вкладки — тогда стейт уже содержит это значение, и
// диспатч пропускается: иначе каждая запись давала бы лишний рендер, а при двух записях в одном тике
// hydrated с промежуточным значением слота затёр бы вторую. Возвращает unsubscribe.
export const subscribeSlot = <State, T>(
  store: SubscribableStore<State>,
  slot: StorageSlot<T>,
  { select, hydrated }: SubscribeSlotOptions<State, T>,
) =>
  slot.subscribe(() => {
    const value = slot.get()
    if (isSameValue(value, select(store.getState()))) return
    store.dispatch(hydrated(value))
  })
