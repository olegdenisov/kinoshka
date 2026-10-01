import {
  configureStore,
  createListenerMiddleware,
  createSlice,
  isAnyOf,
} from '@reduxjs/toolkit'
import type { Middleware, PayloadAction, UnknownAction } from '@reduxjs/toolkit'
import { z } from 'zod'

import { createStorageSlot } from '../storage/storage'
import type { StorageSlot } from '../storage/storage'
import { persistSlice, subscribeSlot } from './persistSlice'

const KEY = 'kinoshka:test-ids'

const listSlice = createSlice({
  name: 'list',
  initialState: { ids: [] as number[] },
  reducers: {
    added: (state, action: PayloadAction<number>) => {
      state.ids.push(action.payload)
    },
    hydrated: (state, action: PayloadAction<number[]>) => {
      state.ids = action.payload
    },
    rolledBack: (state, action: PayloadAction<number[]>) => {
      state.ids = action.payload
    },
  },
  selectors: { selectIds: state => state.ids },
})

const { added, hydrated, rolledBack } = listSlice.actions
const { selectIds } = listSlice.selectors

type State = { list: { ids: number[] } }

// Каждый setup регистрирует свой teardown; afterEach снимает все — и те, что тест уже снял сам
// (повторный unsubscribe безопасен), и не протекает в следующий тест.
const teardowns: Array<() => void> = []

afterEach(() => {
  for (const teardown of teardowns.splice(0)) teardown()
})

const setup = (slot: StorageSlot<number[]>) => {
  const actions: UnknownAction[] = []
  const recorder: Middleware = () => next => action => {
    actions.push(action as UnknownAction)
    return next(action)
  }
  const listenerMiddleware = createListenerMiddleware()
  const store = configureStore({
    reducer: { list: listSlice.reducer },
    middleware: getDefaultMiddleware =>
      getDefaultMiddleware()
        .prepend(listenerMiddleware.middleware)
        .concat(recorder),
  })
  const unlisten = persistSlice({
    startListening: listenerMiddleware.startListening.withTypes<State>(),
    slot,
    select: selectIds,
    // Намеренно широкий matcher: rollback должен исключаться самим persistSlice.
    matcher: isAnyOf(added, rolledBack),
    rollback: rolledBack,
  })
  const unsubscribe = subscribeSlot(store, slot, {
    select: selectIds,
    hydrated,
  })

  const teardown = () => {
    unlisten()
    unsubscribe()
  }
  teardowns.push(teardown)

  return { store, actions, teardown }
}

const createSlot = () => createStorageSlot(KEY, z.array(z.number()), [])

describe('persistSlice', () => {
  it('экшен из matcher записывает значение в localStorage', () => {
    const ctx = setup(createSlot())

    ctx.store.dispatch(added(1))
    ctx.store.dispatch(added(2))

    expect(JSON.parse(localStorage.getItem(KEY) ?? 'null')).toEqual([1, 2])
  })

  it('slot.set вернул false — стейт откатан синхронно, сразу после dispatch', () => {
    const slot = createSlot()
    const set = vi.fn(() => false)
    const ctx = setup({ ...slot, set })

    ctx.store.dispatch(added(1))

    expect(selectIds(ctx.store.getState())).toEqual([])
    // Откат исключён из matcher — повторной попытки записи нет.
    expect(set).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it('откат возвращает значение до экшена, а не пустое', () => {
    localStorage.setItem(KEY, JSON.stringify([7]))
    const slot = createSlot()
    let allowWrite = true
    const ctx = setup({ ...slot, set: value => allowWrite && slot.set(value) })

    ctx.store.dispatch(added(7))
    allowWrite = false
    ctx.store.dispatch(added(8))

    expect(selectIds(ctx.store.getState())).toEqual([7])
  })

  it('hydrated обновляет стейт и не вызывает slot.set', () => {
    const slot = createSlot()
    const set = vi.fn(slot.set)
    const ctx = setup({ ...slot, set })

    ctx.store.dispatch(hydrated([3, 4]))

    expect(selectIds(ctx.store.getState())).toEqual([3, 4])
    expect(set).not.toHaveBeenCalled()
  })
})

describe('subscribeSlot', () => {
  it('storage-событие из другой вкладки попадает в стор', () => {
    const ctx = setup(createSlot())

    localStorage.setItem(KEY, JSON.stringify([5, 6]))
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))

    expect(selectIds(ctx.store.getState())).toEqual([5, 6])
    expect(ctx.actions).toContainEqual(hydrated([5, 6]))
  })

  it('запись из своей вкладки не порождает hydrated', () => {
    const ctx = setup(createSlot())

    ctx.store.dispatch(added(1))
    ctx.store.dispatch(added(2))

    expect(ctx.actions.some(action => hydrated.match(action))).toBe(false)
    expect(selectIds(ctx.store.getState())).toEqual([1, 2])
  })

  it('storage-событие с тем же значением (другая ссылка) не порождает hydrated', () => {
    localStorage.setItem(KEY, JSON.stringify([1, 2]))
    const ctx = setup(createSlot())
    ctx.store.dispatch(hydrated([1, 2]))
    const stateBefore = ctx.store.getState()
    ctx.actions.length = 0

    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))

    expect(ctx.actions).toEqual([])
    expect(ctx.store.getState()).toBe(stateBefore)
  })

  it('после unsubscribe storage-события стор не меняют', () => {
    const ctx = setup(createSlot())
    ctx.teardown()

    localStorage.setItem(KEY, JSON.stringify([9]))
    window.dispatchEvent(new StorageEvent('storage', { key: KEY }))

    expect(selectIds(ctx.store.getState())).toEqual([])
  })
})
