import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import {
  BACKGROUND_RETRY_COOLDOWN_MS,
  GENRE_DICTIONARY_TTL_MS,
  genreDictionarySlot,
  invalidateGenreDictionary,
  isGenreDictionaryStale,
  refreshGenreDictionary,
} from './genreDictionaryCache'

const ENDPOINT = '*/v1.5/dictionary/genres'

const dictionaryItem = (name: string) => ({
  id: 1,
  name,
  slug: null,
  enName: null,
})

const mockSuccess = (names: string[]) => {
  const calls = { count: 0 }
  server.use(
    http.get(ENDPOINT, () => {
      calls.count += 1
      return HttpResponse.json({
        type: 'genres',
        total: names.length,
        items: names.map(dictionaryItem),
      })
    }),
  )
  return calls
}

const mockError = (status = 500) => {
  const calls = { count: 0 }
  server.use(
    http.get(ENDPOINT, () => {
      calls.count += 1
      return HttpResponse.json(
        { statusCode: status, message: 'error', error: 'error' },
        { status },
      )
    }),
  )
  return calls
}

let now = 1_000_000

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isGenreDictionaryStale', () => {
  it('свежий fetchedAt (только что записан) — не устарел', () => {
    expect(isGenreDictionaryStale(now)).toBe(false)
  })

  it('fetchedAt ровно на границе TTL — ещё не устарел (строгое >)', () => {
    const fetchedAt = now
    now += GENRE_DICTIONARY_TTL_MS
    expect(isGenreDictionaryStale(fetchedAt)).toBe(false)
  })

  it('fetchedAt старше TTL на 1мс — устарел', () => {
    const fetchedAt = 0
    now = GENRE_DICTIONARY_TTL_MS + 1
    expect(isGenreDictionaryStale(fetchedAt)).toBe(true)
  })
})

describe('refreshGenreDictionary — in-flight дедупликация', () => {
  it('параллельные вызовы бьют в fetcher один раз', async () => {
    const calls = mockSuccess(['драма', 'боевик'])

    await Promise.all([refreshGenreDictionary(), refreshGenreDictionary()])

    expect(calls.count).toBe(1)
  })
})

describe('refreshGenreDictionary — успех', () => {
  it('пишет items и fetchedAt в слот', async () => {
    mockSuccess(['драма', 'боевик'])

    await refreshGenreDictionary()

    expect(genreDictionarySlot.get()).toEqual({
      items: ['драма', 'боевик'],
      fetchedAt: now,
    })
  })
})

describe('refreshGenreDictionary — ошибка и cooldown', () => {
  it('неудачная попытка не трогает существующий кэш', async () => {
    mockSuccess(['драма'])
    await refreshGenreDictionary()
    const before = genreDictionarySlot.get()

    now += BACKGROUND_RETRY_COOLDOWN_MS + 1
    mockError(500)
    await refreshGenreDictionary()

    expect(genreDictionarySlot.get()).toEqual(before)
  })

  it('в пределах cooldown после ошибки — повторный вызов не делает сетевой запрос', async () => {
    const calls = mockError(500)

    await refreshGenreDictionary()
    now += BACKGROUND_RETRY_COOLDOWN_MS - 1
    await refreshGenreDictionary()

    expect(calls.count).toBe(1)
  })

  it('после истечения cooldown — повторный вызов снова делает сетевой запрос', async () => {
    const calls = mockError(500)

    await refreshGenreDictionary()
    now += BACKGROUND_RETRY_COOLDOWN_MS + 1
    await refreshGenreDictionary()

    expect(calls.count).toBe(2)
  })
})

describe('refreshGenreDictionary — успешный ответ с пустым items', () => {
  it('не бьёт в кулдаун сразу и не даёт бесконечный цикл повторных запросов', async () => {
    const calls = mockSuccess([])

    await refreshGenreDictionary()
    expect(genreDictionarySlot.get()).toEqual({ items: [], fetchedAt: now })

    // items.length === 0 сразу после успешного (но пустого) ответа — без фикса lastAttemptAt
    // на этом шаге второй вызов внутри того же тика/окна прошёл бы кулдаун-проверку заново
    // (lastAttemptAt всё ещё 0) и снова ударил бы в сеть.
    await refreshGenreDictionary()

    expect(calls.count).toBe(1)
  })
})

describe('invalidateGenreDictionary', () => {
  it('чистит слот — get() снова отдаёт fallback', async () => {
    mockSuccess(['драма'])
    await refreshGenreDictionary()
    expect(genreDictionarySlot.get().items).toEqual(['драма'])

    invalidateGenreDictionary()

    expect(genreDictionarySlot.get()).toEqual({ items: [], fetchedAt: 0 })
  })

  it('сбрасывает cooldown — refresh сразу после invalidate делает сетевой запрос, а не no-op', async () => {
    const calls = mockError(500)
    await refreshGenreDictionary()
    expect(calls.count).toBe(1)

    invalidateGenreDictionary()
    await refreshGenreDictionary()

    expect(calls.count).toBe(2)
  })
})
