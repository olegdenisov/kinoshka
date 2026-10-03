import { context } from '@reatom/core'
import { http, HttpResponse } from 'msw'

import { readPersisted, seedPersisted } from '../../../test/persist'
import { server } from '../../../test/setup'
import { STATIC_FALLBACK_COUNTRIES } from './country'
import {
  countries,
  countryDictionary,
  genreDictionary,
  genres,
} from './dictionaries'
import { STATIC_FALLBACK_GENRES } from './genre'

const GENRES_KEY = 'kinoshka:genres'
const COUNTRIES_KEY = 'kinoshka:countries'
const DAY_MS = 24 * 60 * 60 * 1000

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

const waitUntil = async (check: () => boolean) => {
  for (let i = 0; i < 50 && !check(); i++) await flush()
  expect(check()).toBe(true)
}

const items = (names: string[]) =>
  names.map((name, i) => ({ id: i, name, slug: null, enName: null }))

const mockDictionary = (type: 'genres' | 'countries', names: string[]) => {
  const requests = vi.fn()
  server.use(
    http.get(`*/v1.5/dictionary/${type}`, () => {
      requests()
      return HttpResponse.json({
        type,
        total: names.length,
        items: items(names),
      })
    }),
  )
  return requests
}

const mockFailure = (type: 'genres' | 'countries', status = 500) => {
  const requests = vi.fn()
  server.use(
    http.get(`*/v1.5/dictionary/${type}`, () => {
      requests()
      return HttpResponse.json(
        { statusCode: status, message: 'error', error: 'error' },
        { status },
      )
    }),
  )
  return requests
}

// Формат записи withCache в хранилище: пары [ключ, запись]; ключ — массив параметров вызова.
const cacheSnapshot = (names: string[], lastUpdate: number) => [
  [
    [],
    {
      params: [],
      value: names,
      lastUpdate,
      version: 1,
      isAsync: true,
    },
  ],
]

describe('genres', () => {
  it('до загрузки отдаёт статический шорт-лист, затем словарь из API', async () => {
    mockDictionary('genres', ['мелодрама', 'вестерн'])
    const unsubscribe = genres.subscribe()

    expect(genres()).toEqual(STATIC_FALLBACK_GENRES)

    await waitUntil(() => genres()[0]?.name === 'мелодрама')
    expect(genres()).toEqual([{ name: 'мелодрама' }, { name: 'вестерн' }])
    unsubscribe()
  })

  it('при ошибке API остаётся статический шорт-лист', async () => {
    mockFailure('genres', 403)
    const unsubscribe = genres.subscribe()

    await waitUntil(() => genreDictionary.error() !== undefined)

    expect(genres()).toEqual(STATIC_FALLBACK_GENRES)
    unsubscribe()
  })

  it('успешный ответ пишется в localStorage под ключом жанров', async () => {
    mockDictionary('genres', ['вестерн'])
    const unsubscribe = genres.subscribe()

    await waitUntil(() => genres()[0]?.name === 'вестерн')

    expect(readPersisted(GENRES_KEY)).not.toBeNull()
    expect(readPersisted(COUNTRIES_KEY)).toBeNull()
    unsubscribe()
  })

  it('словарь из хранилища не шлёт запрос после пересоздания контекста', async () => {
    const requests = mockDictionary('genres', ['вестерн'])
    const unsubscribe = genres.subscribe()
    await waitUntil(() => genres()[0]?.name === 'вестерн')
    unsubscribe()
    expect(requests).toHaveBeenCalledTimes(1)

    const restored = await context.start(async () => {
      const stop = genres.subscribe()
      await waitUntil(() => genres()[0]?.name === 'вестерн')
      const result = genres()
      stop()
      return result
    })

    expect(restored).toEqual([{ name: 'вестерн' }])
    expect(requests).toHaveBeenCalledTimes(1)
  })

  it('запись старше 7 дней перезапрашивается; до ответа виден статический шорт-лист', async () => {
    seedPersisted(
      GENRES_KEY,
      cacheSnapshot(['старый'], Date.now() - 8 * DAY_MS),
    )
    const requests = mockDictionary('genres', ['новый'])
    const unsubscribe = genres.subscribe()

    expect(genres()).toEqual(STATIC_FALLBACK_GENRES)

    await waitUntil(() => genres()[0]?.name === 'новый')
    expect(requests).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('свежая запись из хранилища отдаётся без запроса', async () => {
    seedPersisted(GENRES_KEY, cacheSnapshot(['свежий'], Date.now() - DAY_MS))
    const requests = mockDictionary('genres', ['другой'])
    const unsubscribe = genres.subscribe()

    await waitUntil(() => genres()[0]?.name === 'свежий')
    await flush()

    expect(requests).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('мусор в хранилище не роняет чтение: статический шорт-лист и запрос', async () => {
    const requests = mockDictionary('genres', ['вестерн'])
    for (const garbage of ['not an array', [['x']], [[[], { value: 5 }]]]) {
      seedPersisted(GENRES_KEY, garbage)
      const result = await context.start(async () => {
        const stop = genres.subscribe()
        const before = genres()
        await waitUntil(() => genres()[0]?.name === 'вестерн')
        stop()
        return before
      })
      expect(result).toEqual(STATIC_FALLBACK_GENRES)
    }
    expect(requests).toHaveBeenCalled()
  })

  it('после ошибки запрос не повторяется, пока контекст жив', async () => {
    const requests = mockFailure('genres')
    const unsubscribe = genres.subscribe()
    await waitUntil(() => genreDictionary.error() !== undefined)

    unsubscribe()
    const again = genres.subscribe()
    await flush()
    await flush()

    expect(requests).toHaveBeenCalledTimes(1)
    again()
  })
})

describe('countries', () => {
  it('до загрузки и при ошибке отдаёт статический шорт-лист', async () => {
    mockFailure('countries')
    const unsubscribe = countries.subscribe()

    expect(countries()).toEqual(STATIC_FALLBACK_COUNTRIES)

    await waitUntil(() => countryDictionary.error() !== undefined)
    expect(countries()).toEqual(STATIC_FALLBACK_COUNTRIES)
    unsubscribe()
  })

  it('отдаёт словарь из API и пишет его под своим ключом', async () => {
    mockDictionary('countries', ['США', 'Аргентина'])
    const unsubscribe = countries.subscribe()

    await waitUntil(() => countries().includes('Аргентина'))

    expect(countries()).toEqual(['США', 'Аргентина'])
    expect(readPersisted(COUNTRIES_KEY)).not.toBeNull()
    expect(readPersisted(GENRES_KEY)).toBeNull()
    unsubscribe()
  })

  it('словарь из хранилища не шлёт запрос после пересоздания контекста', async () => {
    seedPersisted(COUNTRIES_KEY, cacheSnapshot(['Чили'], Date.now() - DAY_MS))
    const requests = mockDictionary('countries', ['США'])

    const result = await context.start(async () => {
      const stop = countries.subscribe()
      await waitUntil(() => countries()[0] === 'Чили')
      const value = countries()
      stop()
      return value
    })

    expect(result).toEqual(['Чили'])
    expect(requests).not.toHaveBeenCalled()
  })
})
