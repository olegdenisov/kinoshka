import {
  BACKGROUND_RETRY_COOLDOWN_MS,
  createDictionaryCache,
  DICTIONARY_TTL_MS,
} from './createDictionaryCache'

let now = 1_000_000
let keyCounter = 0

// Уникальный ключ на тест: слоты разных экземпляров не должны пересекаться в localStorage.
const nextKey = () => `kinoshka:test-dictionary-${++keyCounter}`

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createDictionaryCache — успех', () => {
  it('refresh пишет items и fetchedAt в слот', async () => {
    const cache = createDictionaryCache({
      storageKey: nextKey(),
      fetchItems: () => Promise.resolve(['США', 'Франция']),
    })

    await cache.refresh()

    expect(cache.slot.get()).toEqual({
      items: ['США', 'Франция'],
      fetchedAt: now,
    })
  })

  it('слот создаётся один раз — get() стабилен между обращениями', async () => {
    const cache = createDictionaryCache({
      storageKey: nextKey(),
      fetchItems: () => Promise.resolve(['США']),
    })
    await cache.refresh()

    expect(cache.slot.get()).toBe(cache.slot.get())
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
    const before = cache.slot.get()
    now += BACKGROUND_RETRY_COOLDOWN_MS + 1
    await cache.refresh()

    expect(cache.slot.get()).toEqual(before)
  })

  it('успешный ответ с пустым items тоже включает кулдаун', async () => {
    const fetchItems = vi.fn(() => Promise.resolve<string[]>([]))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })

    await cache.refresh()
    expect(cache.slot.get()).toEqual({ items: [], fetchedAt: now })
    await cache.refresh()

    expect(fetchItems).toHaveBeenCalledTimes(1)
  })
})

describe('createDictionaryCache — invalidate и resetState', () => {
  it('invalidate чистит слот и сбрасывает кулдаун', async () => {
    const fetchItems = vi.fn(() => Promise.resolve(['США']))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })
    await cache.refresh()

    cache.invalidate()
    expect(cache.slot.get()).toEqual({ items: [], fetchedAt: 0 })

    await cache.refresh()
    expect(fetchItems).toHaveBeenCalledTimes(2)
  })

  it('resetState сбрасывает кулдаун, не трогая слот', async () => {
    const fetchItems = vi.fn(() => Promise.resolve(['США']))
    const cache = createDictionaryCache({ storageKey: nextKey(), fetchItems })
    await cache.refresh()

    cache.resetState()
    expect(cache.slot.get().items).toEqual(['США'])

    await cache.refresh()
    expect(fetchItems).toHaveBeenCalledTimes(2)
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
    expect(second.slot.get().items).toEqual(['США'])
    expect(first.slot.get().items).toEqual([])
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

    expect(first.slot.get().items).toEqual(['драма'])
    expect(second.slot.get().items).toEqual(['США'])
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
