import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import {
  BACKGROUND_RETRY_COOLDOWN_MS,
  countryDictionaryCache,
  DICTIONARY_TTL_MS,
} from '../api/createDictionaryCache'
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

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

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
    const { result } = renderHook(() => useCountryDictionary(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current).toEqual(STATIC_FALLBACK_COUNTRIES)

    await waitFor(() => {
      expect(result.current).toEqual(['США', 'Аргентина'])
    })
  })
})

describe('useCountryDictionary — свежий кэш', () => {
  it('рендерится из кэша без запроса', async () => {
    const calls = mockSuccess(['Аргентина'])
    countryDictionaryCache.slot.set({ items: ['Чили'], fetchedAt: now })

    const { result } = renderHook(() => useCountryDictionary(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current).toEqual(['Чили'])
    await flush()
    expect(calls.count).toBe(0)
  })
})

describe('useCountryDictionary — устаревший кэш', () => {
  it('сразу отдаёт кэш и обновляет его в фоне', async () => {
    const calls = mockSuccess(['США', 'Франция'])
    countryDictionaryCache.slot.set({
      items: ['старая страна'],
      fetchedAt: now - DICTIONARY_TTL_MS - 1,
    })

    const { result } = renderHook(() => useCountryDictionary(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current).toEqual(['старая страна'])
    await waitFor(() => {
      expect(result.current).toEqual(['США', 'Франция'])
    })
    expect(calls.count).toBe(1)
    expect(countryDictionaryCache.slot.get()).toEqual({
      items: ['США', 'Франция'],
      fetchedAt: now,
    })
  })
})

describe('useCountryDictionary — ошибка', () => {
  it('не трогает кэш и повторяет запрос только после кулдауна', async () => {
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
    const stale = {
      items: ['старая страна'],
      fetchedAt: now - DICTIONARY_TTL_MS - 1,
    }
    countryDictionaryCache.slot.set(stale)
    const wrapper = createStoreWrapper()

    const first = renderHook(() => useCountryDictionary(), { wrapper })
    await waitFor(() => {
      expect(calls.count).toBe(1)
    })
    expect(first.result.current).toEqual(['старая страна'])
    expect(countryDictionaryCache.slot.get()).toEqual(stale)
    first.unmount()

    now += BACKGROUND_RETRY_COOLDOWN_MS - 1
    const second = renderHook(() => useCountryDictionary(), { wrapper })
    await flush()
    expect(calls.count).toBe(1)
    second.unmount()

    now += 1
    renderHook(() => useCountryDictionary(), { wrapper })
    await waitFor(() => {
      expect(calls.count).toBe(2)
    })
  })
})

describe('useCountryDictionary — пустой ответ', () => {
  it('items: [] оставляет фолбэк и не зацикливает запросы', async () => {
    const calls = mockSuccess([])
    const wrapper = createStoreWrapper()
    const { result, unmount } = renderHook(() => useCountryDictionary(), {
      wrapper,
    })

    await waitFor(() => {
      expect(calls.count).toBe(1)
    })
    await flush()
    unmount()
    const second = renderHook(() => useCountryDictionary(), { wrapper })
    await flush()

    expect(calls.count).toBe(1)
    expect(result.current).toEqual(STATIC_FALLBACK_COUNTRIES)
    expect(second.result.current).toEqual(STATIC_FALLBACK_COUNTRIES)
  })
})
