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

describe('createDictionaryCache — isFresh', () => {
  it('пустой слот не свежий', () => {
    const cache = createDictionaryCache(nextKey())

    expect(cache.isFresh()).toBe(false)
  })

  it('непустой кеш моложе TTL — свежий, старше TTL — нет', () => {
    const cache = createDictionaryCache(nextKey())
    cache.save(['США'])

    now += DICTIONARY_TTL_MS
    expect(cache.isFresh()).toBe(true)

    now += 1
    expect(cache.isFresh()).toBe(false)
  })
})

describe('createDictionaryCache — save', () => {
  it('пишет items и fetchedAt в слот', () => {
    const cache = createDictionaryCache(nextKey())

    cache.save(['США', 'Франция'])

    expect(cache.slot.get()).toEqual({
      items: ['США', 'Франция'],
      fetchedAt: now,
    })
  })

  it('пустой ответ не затирает существующий кеш', () => {
    const cache = createDictionaryCache(nextKey())
    cache.save(['США'])
    const before = cache.slot.get()

    now += 1000
    cache.save([])

    expect(cache.slot.get()).toEqual(before)
  })
})

describe('createDictionaryCache — кулдаун', () => {
  it('повтор в пределах кулдауна запрещён, после — разрешён', () => {
    const cache = createDictionaryCache(nextKey())

    expect(cache.tryStartAttempt()).toBe(true)
    now += BACKGROUND_RETRY_COOLDOWN_MS - 1
    expect(cache.tryStartAttempt()).toBe(false)

    now += 1
    expect(cache.tryStartAttempt()).toBe(true)
  })

  it('resetCooldown снимает кулдаун, не трогая слот', () => {
    const cache = createDictionaryCache(nextKey())
    cache.save(['США'])
    cache.tryStartAttempt()

    cache.resetCooldown()

    expect(cache.tryStartAttempt()).toBe(true)
    expect(cache.slot.get().items).toEqual(['США'])
  })

  it('кулдаун одного экземпляра не блокирует другой', () => {
    const first = createDictionaryCache(nextKey())
    const second = createDictionaryCache(nextKey())

    first.tryStartAttempt()

    expect(second.tryStartAttempt()).toBe(true)
  })
})
