import { createSessionCache } from './sessionCache'

beforeEach(() => sessionStorage.clear())
afterEach(() => vi.unstubAllEnvs())

describe('createSessionCache', () => {
  it('DEV=true — set → get возвращает то же значение', () => {
    vi.stubEnv('DEV', true)
    const cache = createSessionCache<number[]>('test')

    cache.set('key', { data: [1, 2, 3], timestamp: 123, isError: false })

    expect(cache.get('key')).toEqual({
      data: [1, 2, 3],
      timestamp: 123,
      isError: false,
    })
  })

  it('Namespace — ключ в sessionStorage формируется как kinoshka:<namespace>:<key>', () => {
    vi.stubEnv('DEV', true)
    const cache = createSessionCache<number[]>('movies')

    cache.set('abc', { data: [1], timestamp: 1, isError: false })

    expect(sessionStorage.getItem('kinoshka:movies:abc')).not.toBeNull()
  })

  it('Отсутствие ключа — get() возвращает undefined', () => {
    vi.stubEnv('DEV', true)
    const cache = createSessionCache<number[]>('test')

    expect(cache.get('missing')).toBeUndefined()
  })

  it('Невалидный JSON — get() возвращает undefined (не бросает)', () => {
    vi.stubEnv('DEV', true)
    const cache = createSessionCache<number[]>('test')

    sessionStorage.setItem('kinoshka:test:key', '{invalid json}')

    expect(() => cache.get('key')).not.toThrow()
    expect(cache.get('key')).toBeUndefined()
  })

  it('DEV=false — set() не пишет в sessionStorage', () => {
    vi.stubEnv('DEV', false)
    const cache = createSessionCache<number[]>('test')

    cache.set('key', { data: [1], timestamp: 1, isError: false })

    expect(sessionStorage.getItem('kinoshka:test:key')).toBeNull()
  })

  it('DEV=false — get() возвращает undefined, даже если значение реально есть в sessionStorage', () => {
    sessionStorage.setItem(
      'kinoshka:test:key',
      JSON.stringify({ data: [1], timestamp: 1, isError: false }),
    )
    vi.stubEnv('DEV', false)
    const cache = createSessionCache<number[]>('test')

    expect(cache.get('key')).toBeUndefined()
  })

  it('Переполнение квоты — setItem бросает исключение, set() не падает', () => {
    vi.stubEnv('DEV', true)
    const cache = createSessionCache<number[]>('test')
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    expect(() =>
      cache.set('key', { data: [1], timestamp: 1, isError: false }),
    ).not.toThrow()

    setItemSpy.mockRestore()
  })

  it('Изоляция по namespace — разные неймспейсы не пересекаются по ключам', () => {
    vi.stubEnv('DEV', true)
    const movies = createSessionCache<number[]>('movies')
    const search = createSessionCache<number[]>('search')

    movies.set('key', { data: [1], timestamp: 1, isError: false })

    expect(search.get('key')).toBeUndefined()
  })
})
