import { http, HttpResponse } from 'msw'

import { makeStore } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import {
  BACKGROUND_RETRY_COOLDOWN_MS,
  countryDictionaryCache,
  genreDictionaryCache,
} from './createDictionaryCache'
import { dictionaryApi } from './dictionaryApi'

const errorBody = (status: number) => ({
  statusCode: status,
  message: 'Forbidden',
  error: 'Forbidden',
})

describe('getGenreDictionary / getCountryDictionary', () => {
  const GENRES_ENDPOINT = '*/v1.5/dictionary/genres'
  const COUNTRIES_ENDPOINT = '*/v1.5/dictionary/countries'

  const mockDictionary = (endpoint: string, names: string[], status = 200) => {
    const calls = { count: 0, url: '' }
    server.use(
      http.get(endpoint, ({ request }) => {
        calls.count += 1
        calls.url = request.url
        return status === 200
          ? HttpResponse.json({
              type: 'x',
              total: names.length,
              items: names.map((name, i) => ({
                id: i,
                name,
                slug: null,
                enName: null,
              })),
            })
          : HttpResponse.json(errorBody(status), { status })
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

  it('успех: отдаёт имена и пишет их в слот со временем загрузки', async () => {
    const calls = mockDictionary(GENRES_ENDPOINT, ['драма', 'боевик'])

    const result = await makeStore().dispatch(
      dictionaryApi.endpoints.getGenreDictionary.initiate(),
    )

    expect(new URL(calls.url).pathname).toBe('/v1.5/dictionary/genres')
    expect(result.data).toEqual(['драма', 'боевик'])
    expect(genreDictionaryCache.slot.get()).toEqual({
      items: ['драма', 'боевик'],
      fetchedAt: now,
    })
  })

  it('страны пишутся в свой слот, жанровый не трогается', async () => {
    const calls = mockDictionary(COUNTRIES_ENDPOINT, ['США'])

    await makeStore().dispatch(
      dictionaryApi.endpoints.getCountryDictionary.initiate(),
    )

    expect(new URL(calls.url).pathname).toBe('/v1.5/dictionary/countries')
    expect(countryDictionaryCache.slot.get().items).toEqual(['США'])
    expect(genreDictionaryCache.slot.get().items).toEqual([])
  })

  it('ошибка → QueryError со status, существующий кеш не тронут', async () => {
    genreDictionaryCache.save(['триллер'])
    const before = genreDictionaryCache.slot.get()
    mockDictionary(GENRES_ENDPOINT, [], 403)

    const result = await makeStore().dispatch(
      dictionaryApi.endpoints.getGenreDictionary.initiate(),
    )

    expect(result.error).toEqual({ status: 403, message: 'Forbidden' })
    expect(genreDictionaryCache.slot.get()).toEqual(before)
  })

  it('error-DTO в теле 200-ответа → QueryError со status из тела, кеш не тронут', async () => {
    countryDictionaryCache.save(['Франция'])
    const before = countryDictionaryCache.slot.get()
    server.use(
      http.get(COUNTRIES_ENDPOINT, () =>
        HttpResponse.json({ statusCode: 401, message: 'No key', error: 'x' }),
      ),
    )

    const result = await makeStore().dispatch(
      dictionaryApi.endpoints.getCountryDictionary.initiate(),
    )

    expect(result.error).toEqual({ status: 401, message: 'No key' })
    expect(countryDictionaryCache.slot.get()).toEqual(before)
  })

  it('пустой ответ не затирает кеш', async () => {
    genreDictionaryCache.save(['триллер'])
    now += 1000
    mockDictionary(GENRES_ENDPOINT, [])

    const result = await makeStore().dispatch(
      dictionaryApi.endpoints.getGenreDictionary.initiate(),
    )

    expect(result.data).toEqual([])
    expect(genreDictionaryCache.slot.get()).toEqual({
      items: ['триллер'],
      fetchedAt: 1_000_000,
    })
  })

  it('параллельные подписки дают один запрос', async () => {
    const calls = mockDictionary(GENRES_ENDPOINT, ['драма'])
    const store = makeStore()

    await Promise.all([
      store.dispatch(dictionaryApi.endpoints.getGenreDictionary.initiate()),
      store.dispatch(dictionaryApi.endpoints.getGenreDictionary.initiate()),
    ])

    expect(calls.count).toBe(1)
  })

  it('после ошибки повтор в пределах кулдауна не бьёт в сеть, после — бьёт', async () => {
    const calls = mockDictionary(COUNTRIES_ENDPOINT, [], 500)
    const store = makeStore()
    const refetch = () =>
      store.dispatch(
        dictionaryApi.endpoints.getCountryDictionary.initiate(undefined, {
          forceRefetch: true,
        }),
      )

    await refetch()
    now += BACKGROUND_RETRY_COOLDOWN_MS - 1
    const blocked = await refetch()
    expect(blocked.isError).toBe(true)
    expect(calls.count).toBe(1)

    now += 1
    await refetch()
    expect(calls.count).toBe(2)
  })
})
