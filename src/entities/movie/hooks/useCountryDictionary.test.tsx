import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { countryDictionarySlot } from '../api/countryDictionaryCache'
import {
  BACKGROUND_RETRY_COOLDOWN_MS,
  DICTIONARY_TTL_MS,
} from '../api/createDictionaryCache'
import { genreDictionarySlot } from '../api/genreDictionaryCache'
import { STATIC_FALLBACK_COUNTRIES } from '../model/country'
import { useCountryDictionary } from './useCountryDictionary'

const ENDPOINT = '*/v1.5/dictionary/countries'

const mockSuccess = (names: string[]) => {
  const calls = { count: 0 }
  server.use(
    http.get(ENDPOINT, () => {
      calls.count += 1
      return HttpResponse.json({
        type: 'countries',
        total: names.length,
        items: names.map((name, i) => ({
          id: i,
          name,
          slug: null,
          enName: null,
        })),
      })
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

describe('useCountryDictionary — пустой кэш', () => {
  it('сначала отдаёт статический фолбэк, затем данные из API', async () => {
    mockSuccess(['США', 'Аргентина'])
    const { result } = renderHook(() => useCountryDictionary())

    expect(result.current).toEqual(STATIC_FALLBACK_COUNTRIES)

    await waitFor(() => {
      expect(result.current).toEqual(['США', 'Аргентина'])
    })
  })

  it('пишет в свой слот, жанровый не трогает', async () => {
    mockSuccess(['США'])
    renderHook(() => useCountryDictionary())

    await waitFor(() => {
      expect(countryDictionarySlot.get().items).toEqual(['США'])
    })
    expect(genreDictionarySlot.get().items).toEqual([])
  })
})

describe('useCountryDictionary — свежий кэш', () => {
  it('рендерится из кэша без фонового запроса', async () => {
    const calls = mockSuccess(['Аргентина'])
    countryDictionarySlot.set({ items: ['Чили'], fetchedAt: now })

    const { result } = renderHook(() => useCountryDictionary())

    expect(result.current).toEqual(['Чили'])
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(calls.count).toBe(0)
  })
})

describe('useCountryDictionary — устаревший кэш', () => {
  it('сразу отдаёт кэш и обновляет его в фоне ровно одним запросом', async () => {
    const calls = mockSuccess(['США', 'Франция'])
    countryDictionarySlot.set({
      items: ['старая страна'],
      fetchedAt: now - DICTIONARY_TTL_MS - 1,
    })

    const { result } = renderHook(() => useCountryDictionary())

    expect(result.current).toEqual(['старая страна'])
    // Второй потребитель, смонтированный до ответа, дедуплицируется in-flight-промисом.
    renderHook(() => useCountryDictionary())

    await waitFor(() => {
      expect(result.current).toEqual(['США', 'Франция'])
    })
    expect(calls.count).toBe(1)
  })
})

describe('useCountryDictionary — ошибка', () => {
  it('остаётся на фолбэке и не повторяет запрос в пределах кулдауна', async () => {
    const calls = { count: 0 }
    server.use(
      http.get(ENDPOINT, () => {
        calls.count += 1
        return HttpResponse.json(
          { statusCode: 500, message: 'error', error: 'error' },
          { status: 500 },
        )
      }),
    )

    const first = renderHook(() => useCountryDictionary())

    await waitFor(() => {
      expect(calls.count).toBe(1)
    })
    expect(first.result.current).toEqual(STATIC_FALLBACK_COUNTRIES)
    first.unmount()

    // Ремаунт перезапускает эффект — rerender() этого не делает (deps не меняются).
    now += BACKGROUND_RETRY_COOLDOWN_MS - 1
    const second = renderHook(() => useCountryDictionary())
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(calls.count).toBe(1)
    expect(second.result.current).toEqual(STATIC_FALLBACK_COUNTRIES)
    second.unmount()

    now += 2
    renderHook(() => useCountryDictionary())
    await waitFor(() => {
      expect(calls.count).toBe(2)
    })
  })
})

describe('useCountryDictionary — пустой ответ', () => {
  it('items: [] оставляет фолбэк и не зацикливает запросы', async () => {
    const calls = mockSuccess([])
    const { result, unmount } = renderHook(() => useCountryDictionary())

    await waitFor(() => {
      expect(countryDictionarySlot.get().fetchedAt).toBe(now)
    })
    unmount()
    renderHook(() => useCountryDictionary())
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(calls.count).toBe(1)
    expect(result.current).toEqual(STATIC_FALLBACK_COUNTRIES)
  })
})
