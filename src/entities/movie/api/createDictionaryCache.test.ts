import { resetAllStores } from '@shared/lib'

import {
  BACKGROUND_RETRY_COOLDOWN_MS,
  createDictionaryCache,
  DICTIONARY_TTL_MS,
} from './createDictionaryCache'

let now = 1_000_000
let keyCounter = 0

// Уникальный ключ на тест: сторы разных экземпляров не должны пересекаться в localStorage.
const nextKey = () => `kinoshka:test-dictionary-${++keyCounter}`

const snapshot = (cache: ReturnType<typeof createDictionaryCache>) => {
  const { items, fetchedAt } = cache.useStore.getState()

  return { items, fetchedAt }
}

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createDictionaryCache — persist', () => {
  it('стор при создании читает сохранённый кэш прежнего формата', () => {
    const storageKey = nextKey()
    localStorage.setItem(
      storageKey,
      JSON.stringify({ items: ['Чили'], fetchedAt: 42 }),
    )

    const cache = createDictionaryCache({
      storageKey,
      fetchItems: () => Promise.resolve([]),
    })

    expect(snapshot(cache)).toEqual({ items: ['Чили'], fetchedAt: 42 })
  })

  it('битый кэш — фолбэк { items: [], fetchedAt: 0 }', () => {
    const storageKey = nextKey()
    localStorage.setItem(storageKey, '{"items":"не массив"}')

    const cache = createDictionaryCache({
      storageKey,
      fetchItems: () => Promise.resolve([]),
    })

    expect(snapshot(cache)).toEqual({ items: [], fetchedAt: 0 })
  })

  it('refresh пишет в localStorage голый { items, fetchedAt } без envelope persist', async () => {
    const storageKey = nextKey()
    const cache = createDictionaryCache({
      storageKey,
      fetchItems: () => Promise.resolve(['США', 'Франция']),
    })

    await cache.refresh()

    expect(snapshot(cache)).toEqual({
      items: ['США', 'Франция'],
      fetchedAt: now,
    })
    expect(JSON.parse(localStorage.getItem(storageKey) ?? 'null')).toEqual({
      items: ['США', 'Франция'],
      fetchedAt: now,
    })
  })

  it('кулдаун не персистится: в хранилище только items и fetchedAt', async () => {
    const storageKey = nextKey()
    const cache = createDictionaryCache({
      storageKey,
      fetchItems: () => Promise.reject(new Error('boom')),
    })

    await cache.refresh()

    expect(localStorage.getItem(storageKey)).toBeNull()
  })
})

describe('createDictionaryCache — in-flight дедупликация', () => {
  it('параллельные вызовы дают один запрос', async () => {
    const fetchItems = vi.fn(() => Promise.resolve(['США']))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })

    await Promise.all([cache.refresh(), cache.refresh(), cache.refresh()])

    expect(fetchItems).toHaveBeenCalledTimes(1)
  })
})

describe('createDictionaryCache — кулдаун', () => {
  it('после ошибки повтор в пределах кулдауна не делает запрос, после — делает', async () => {
    const fetchItems = vi.fn(() => Promise.reject(new Error('boom')))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })

    await cache.refresh()
    now += BACKGROUND_RETRY_COOLDOWN_MS - 1
    await cache.refresh()
    expect(fetchItems).toHaveBeenCalledTimes(1)

    now += 2
    await cache.refresh()
    expect(fetchItems).toHaveBeenCalledTimes(2)
  })

  it('ошибка не трогает существующий кэш', async () => {
    const fetchItems = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['США'])
      .mockRejectedValueOnce(new Error('boom'))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })

    await cache.refresh()
    const before = snapshot(cache)
    now += BACKGROUND_RETRY_COOLDOWN_MS + 1
    await cache.refresh()

    expect(snapshot(cache)).toEqual(before)
  })

  it('успешный ответ с пустым items тоже включает кулдаун', async () => {
    const fetchItems = vi.fn(() => Promise.resolve<string[]>([]))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })

    await cache.refresh()
    expect(snapshot(cache)).toEqual({ items: [], fetchedAt: now })
    await cache.refresh()

    expect(fetchItems).toHaveBeenCalledTimes(1)
  })
})

describe('createDictionaryCache — пустой ответ', () => {
  it('не затирает уже загруженный справочник', async () => {
    const fetchItems = vi
      .fn<() => Promise<string[]>>()
      .mockResolvedValueOnce(['США'])
      .mockResolvedValueOnce([])
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })

    await cache.refresh()
    const before = snapshot(cache)
    now += BACKGROUND_RETRY_COOLDOWN_MS + 1
    await cache.refresh()

    expect(fetchItems).toHaveBeenCalledTimes(2)
    expect(snapshot(cache)).toEqual(before)
  })
})

describe('createDictionaryCache — resetAllStores', () => {
  it('сбрасывает кулдаун и перечитывает хранилище', async () => {
    const fetchItems = vi.fn(() => Promise.resolve(['США']))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })
    await cache.refresh()

    resetAllStores()
    expect(snapshot(cache).items).toEqual(['США'])

    await cache.refresh()
    expect(fetchItems).toHaveBeenCalledTimes(2)
  })

  it('ответ запроса, стартовавшего до сброса, не пишет в стор', async () => {
    let resolveFetch: (items: string[]) => void = () => {}
    const storageKey = nextKey()
    const cache = createDictionaryCache({
      storageKey,
      fetchItems: () =>
        new Promise<string[]>(resolve => {
          resolveFetch = resolve
        }),
    })

    const pending = cache.refresh()
    resetAllStores()
    resolveFetch(['США'])
    await pending

    expect(snapshot(cache)).toEqual({ items: [], fetchedAt: 0 })
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('запоздавший старый запрос не сбрасывает in-flight нового после сброса', async () => {
    const resolvers: Array<(items: string[]) => void> = []
    const fetchItems = vi.fn(
      () =>
        new Promise<string[]>(resolve => {
          resolvers.push(resolve)
        }),
    )
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })

    const stale = cache.refresh()
    resetAllStores()
    const fresh = cache.refresh()

    resolvers[0](['старая страна'])
    await stale
    // Новый запрос всё ещё in-flight — повторный вызов (уже вне кулдауна) дедуплицируется,
    // а не стартует третий.
    now += BACKGROUND_RETRY_COOLDOWN_MS + 1
    void cache.refresh()
    expect(fetchItems).toHaveBeenCalledTimes(2)

    resolvers[1](['США'])
    await fresh
    expect(snapshot(cache).items).toEqual(['США'])
  })
})

describe('createDictionaryCache — изоляция экземпляров', () => {
  it('кулдаун одного экземпляра не блокирует другой', async () => {
    const failing = vi.fn(() => Promise.reject(new Error('boom')))
    const working = vi.fn(() => Promise.resolve(['США']))
    const first = createDictionaryCache({
      storageKey: nextKey(),
      fetchItems: failing,
    })
    const second = createDictionaryCache({
      storageKey: nextKey(),
      fetchItems: working,
    })

    await first.refresh()
    await second.refresh()

    expect(failing).toHaveBeenCalledTimes(1)
    expect(working).toHaveBeenCalledTimes(1)
    expect(snapshot(second).items).toEqual(['США'])
    expect(snapshot(first).items).toEqual([])
  })

  it('in-flight одного экземпляра не переиспользуется другим', async () => {
    const first = createDictionaryCache({
      storageKey: nextKey(),
      fetchItems: () => Promise.resolve(['драма']),
    })
    const second = createDictionaryCache({
      storageKey: nextKey(),
      fetchItems: () => Promise.resolve(['США']),
    })

    await Promise.all([first.refresh(), second.refresh()])

    expect(snapshot(first).items).toEqual(['драма'])
    expect(snapshot(second).items).toEqual(['США'])
  })
})

describe('createDictionaryCache — isStale', () => {
  it('свежий fetchedAt — не устарел, старше TTL — устарел', () => {
    const cache = createDictionaryCache({
      storageKey: nextKey(),
      fetchItems: () => Promise.resolve([]),
    })

    expect(cache.isStale(now)).toBe(false)
    expect(cache.isStale(now - DICTIONARY_TTL_MS)).toBe(false)
    expect(cache.isStale(now - DICTIONARY_TTL_MS - 1)).toBe(true)
  })
})
