import { z } from 'zod'

import { seedStorage } from '../../../test/seedStorage'
import { createStorageSlot } from '../storage'
import { createPersistedStore } from './createPersistedStore'
import { resetAllStores } from './registry'

type IdsState = {
  ids: number[]
  toggle: (id: number) => boolean
}

// Уникальный ключ на каждый стор: сторы и подписки слотов живут до конца файла
let keyCounter = 0
const nextKey = () => `persisted-store-test-${++keyCounter}`

const createIdsStore = (key: string) => {
  const slot = createStorageSlot(key, z.array(z.number()), [])

  return createPersistedStore<IdsState, number[]>({
    name: 'ids',
    slot,
    select: state => state.ids,
    merge: (ids, state) => ({ ...state, ids }),
    creator: (commit, get) => ({
      ids: [],
      toggle: id => {
        const ids = get().ids
        return commit({
          ids: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
        })
      },
    }),
  })
}

afterEach(() => vi.restoreAllMocks())

describe('createPersistedStore — гидрация', () => {
  it('при создании читает значение из localStorage синхронно', () => {
    const key = nextKey()
    localStorage.setItem(key, JSON.stringify([1, 2]))

    const store = createIdsStore(key)

    expect(store.getState().ids).toEqual([1, 2])
  })

  it('merge кладёт голое значение в поле, экшены остаются', () => {
    const key = nextKey()
    localStorage.setItem(key, JSON.stringify([3]))

    const state = createIdsStore(key).getState()

    expect(Object.keys(state).sort()).toEqual(['ids', 'toggle'])
    expect(typeof state.toggle).toBe('function')
  })

  it('невалидный JSON → fallback слота', () => {
    const key = nextKey()
    localStorage.setItem(key, 'not-json')

    expect(createIdsStore(key).getState().ids).toEqual([])
  })

  it('несовпадение схемы → fallback слота', () => {
    const key = nextKey()
    localStorage.setItem(key, JSON.stringify(['a', 'b']))

    expect(createIdsStore(key).getState().ids).toEqual([])
  })
})

describe('createPersistedStore — запись', () => {
  it('пишет голый JSON значения, без envelope { state, version }', () => {
    const key = nextKey()
    const store = createIdsStore(key)

    expect(store.getState().toggle(5)).toBe(true)

    expect(localStorage.getItem(key)).toBe('[5]')
    expect(store.getState().ids).toEqual([5])
  })

  it('два toggle в одном тике не затирают друг друга (экшен читает get())', () => {
    const store = createIdsStore(nextKey())

    store.getState().toggle(1)
    store.getState().toggle(2)

    expect(store.getState().ids).toEqual([1, 2])
  })

  it('неудачная запись → false, стейт прежний, повторной записи нет', () => {
    const key = nextKey()
    localStorage.setItem(key, JSON.stringify([1]))
    const store = createIdsStore(key)
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })

    expect(store.getState().toggle(2)).toBe(false)

    expect(store.getState().ids).toEqual([1])
    // откат через rehydrate не пишет значение обратно в хранилище
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('commit снаружи стора возвращает boolean успеха записи', () => {
    const key = nextKey()
    const store = createIdsStore(key)

    expect(store.commit({ ids: [7] })).toBe(true)
    expect(localStorage.getItem(key)).toBe('[7]')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })

    expect(store.commit({ ids: [8] })).toBe(false)
    expect(store.getState().ids).toEqual([7])
  })

  it('запись массива в своей вкладке даёт подписчикам ровно одно уведомление', () => {
    const store = createIdsStore(nextKey())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    store.getState().toggle(1)

    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})

describe('createPersistedStore — синхронизация и сброс', () => {
  it('storage-событие из другой вкладки обновляет стор', () => {
    const key = nextKey()
    const store = createIdsStore(key)

    localStorage.setItem(key, JSON.stringify([4, 5]))
    window.dispatchEvent(new StorageEvent('storage', { key }))

    expect(store.getState().ids).toEqual([4, 5])
  })

  it('storage-событие с чужим ключом стор не трогает', () => {
    const key = nextKey()
    const store = createIdsStore(key)
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    window.dispatchEvent(new StorageEvent('storage', { key: nextKey() }))

    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('seedStorage обновляет уже созданный стор', () => {
    const key = nextKey()
    const store = createIdsStore(key)

    seedStorage(key, JSON.stringify([9]))

    expect(store.getState().ids).toEqual([9])
  })

  it('resetAllStores перечитывает хранилище', () => {
    const key = nextKey()
    const store = createIdsStore(key)
    store.getState().toggle(1)

    localStorage.removeItem(key)
    resetAllStores()

    expect(store.getState().ids).toEqual([])
  })
})

describe('createPersistedStore — devtools', () => {
  it('в тестовом окружении (без расширения) не пишет предупреждений', () => {
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')

    const store = createIdsStore(nextKey())
    store.getState().toggle(1)

    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })
})
