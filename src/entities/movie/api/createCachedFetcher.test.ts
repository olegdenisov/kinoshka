import { createCachedFetcher } from './createCachedFetcher'
import type { Movie } from '../model/types'

// Мирроят TTL-константы из createCachedFetcher.ts — при их изменении там нужно поправить и здесь.
const CACHE_TTL_MS = 5 * 60 * 1000
const ERROR_CACHE_TTL_MS = 20 * 1000

const movie = (id = 1): Movie => ({
  id,
  title: 'M',
  rating: 1,
  type: 'movie',
  genre: [],
  runtime: '0',
  hue: 0,
})

const okFetcher = (result: Movie[] = [movie()]) => {
  const calls = { count: 0 }
  const fetcher = async () => {
    calls.count += 1
    return result
  }
  return { fetcher, calls }
}

const errFetcher = (message = 'Forbidden') => {
  const calls = { count: 0 }
  const fetcher = async () => {
    calls.count += 1
    throw new Error(message)
  }
  return { fetcher, calls }
}

let now = 1_000_000

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('createCachedFetcher — in-memory кэш', () => {
  it('Дедупликация — параллельные вызовы с одинаковыми params вызывают fetcher один раз', async () => {
    const { fetcher, calls } = okFetcher()
    const get = createCachedFetcher('ns', fetcher)

    const [a, b] = await Promise.all([get({ q: 1 }), get({ q: 1 })])

    expect(calls.count).toBe(1)
    expect(a).toBe(b)
  })

  it('Резолвится значением, которое вернул fetcher', async () => {
    const data = [movie(7)]
    const { fetcher } = okFetcher(data)
    const get = createCachedFetcher('ns', fetcher)

    expect(await get({ q: 1 })).toBe(data)
  })

  it('В пределах TTL — повторный вызов после resolve не дёргает fetcher', async () => {
    const { fetcher, calls } = okFetcher()
    const get = createCachedFetcher('ns', fetcher)

    await get({ q: 1 })
    await get({ q: 1 })

    expect(calls.count).toBe(1)
  })

  it('После истечения TTL — повторный вызов снова дёргает fetcher', async () => {
    const { fetcher, calls } = okFetcher()
    const get = createCachedFetcher('ns', fetcher)

    await get({ q: 1 })
    now += CACHE_TTL_MS + 1
    await get({ q: 1 })

    expect(calls.count).toBe(2)
  })

  it('Разные params — не используют общий кэш', async () => {
    const { fetcher, calls } = okFetcher()
    const get = createCachedFetcher('ns', fetcher)

    await get({ q: 1 })
    await get({ q: 2 })

    expect(calls.count).toBe(2)
  })
})

describe('createCachedFetcher — cooldown при ошибке', () => {
  it('Fetcher бросает — промис реджектится реальным сообщением', async () => {
    const { fetcher } = errFetcher('Forbidden')
    const get = createCachedFetcher('ns', fetcher)

    await expect(get({ q: 1 })).rejects.toThrow('Forbidden')
  })

  it('В пределах cooldown — повторный вызов не дёргает fetcher и снова реджектится сообщением', async () => {
    const { fetcher, calls } = errFetcher('Forbidden')
    const get = createCachedFetcher('ns', fetcher)

    await expect(get({ q: 1 })).rejects.toThrow('Forbidden')
    await expect(get({ q: 1 })).rejects.toThrow('Forbidden')

    expect(calls.count).toBe(1)
  })

  it('После истечения cooldown — повторный вызов снова дёргает fetcher', async () => {
    const { fetcher, calls } = errFetcher()
    const get = createCachedFetcher('ns', fetcher)

    await expect(get({ q: 1 })).rejects.toThrow()
    now += ERROR_CACHE_TTL_MS + 1
    await expect(get({ q: 1 })).rejects.toThrow()

    expect(calls.count).toBe(2)
  })
})

describe('createCachedFetcher — dev-кэш в sessionStorage переживает reload/HMR', () => {
  // «Перезагрузка» модуля: новый инстанс фабрики с тем же namespace — свежий in-memory Map,
  // но общий sessionStorage.
  it('Успех — восстанавливается из sessionStorage без нового вызова fetcher', async () => {
    const { fetcher, calls } = okFetcher()

    const first = createCachedFetcher('ns', fetcher)
    const a = await first({ q: 1 })

    const second = createCachedFetcher('ns', fetcher)
    const b = await second({ q: 1 })

    expect(calls.count).toBe(1)
    expect(b).toEqual(a)
  })

  it('Cooldown ошибки — восстанавливается из sessionStorage и несёт реальное сообщение', async () => {
    const { fetcher, calls } = errFetcher('Forbidden')

    const first = createCachedFetcher('ns', fetcher)
    await expect(first({ q: 1 })).rejects.toThrow('Forbidden')

    const second = createCachedFetcher('ns', fetcher)
    await expect(second({ q: 1 })).rejects.toThrow('Forbidden')

    expect(calls.count).toBe(1)
  })

  it('Истёкший sessionStorage-снапшот игнорируется — после reload и истечения TTL уходит новый вызов', async () => {
    const { fetcher, calls } = okFetcher()

    const first = createCachedFetcher('ns', fetcher)
    await first({ q: 1 })

    now += CACHE_TTL_MS + 1
    const second = createCachedFetcher('ns', fetcher)
    await second({ q: 1 })

    expect(calls.count).toBe(2)
  })

  it('Разные namespace — не делят sessionStorage-снапшот', async () => {
    const { fetcher, calls } = okFetcher()

    const getA = createCachedFetcher('a', fetcher)
    const getB = createCachedFetcher('b', fetcher)

    await getA({ q: 1 })
    await getB({ q: 1 })

    expect(calls.count).toBe(2)
  })

  it('DEV=false — снапшот не персистится, после reload уходит новый вызов', async () => {
    vi.stubEnv('DEV', false)
    const { fetcher, calls } = okFetcher()

    const first = createCachedFetcher('ns', fetcher)
    await first({ q: 1 })

    const second = createCachedFetcher('ns', fetcher)
    await second({ q: 1 })

    expect(calls.count).toBe(2)
  })
})
