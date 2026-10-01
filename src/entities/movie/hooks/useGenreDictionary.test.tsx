import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { createStoreWrapper } from '../../../test/renderWithStore'
import { server } from '../../../test/setup'
import {
  DICTIONARY_TTL_MS,
  genreDictionaryCache,
} from '../api/createDictionaryCache'
import { STATIC_FALLBACK_GENRES } from '../model/genre'
import { useGenreDictionary } from './useGenreDictionary'

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

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

let now = 1_000_000

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useGenreDictionary — пустой кэш', () => {
  it('первый рендер сразу отдаёт статический фолбэк, затем данные из API', async () => {
    mockSuccess(['драма', 'боевик'])
    const { result } = renderHook(() => useGenreDictionary(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current).toEqual(STATIC_FALLBACK_GENRES)

    await waitFor(() => {
      expect(result.current).toEqual([{ name: 'драма' }, { name: 'боевик' }])
    })
    expect(genreDictionaryCache.slot.get().items).toEqual(['драма', 'боевик'])
  })
})

describe('useGenreDictionary — свежий кэш', () => {
  it('рендерится сразу из кэша, запроса не происходит', async () => {
    const calls = mockSuccess(['триллер'])
    genreDictionaryCache.slot.set({ items: ['триллер'], fetchedAt: now })

    const { result, rerender } = renderHook(() => useGenreDictionary(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current).toEqual([{ name: 'триллер' }])
    rerender()
    await flush()
    expect(calls.count).toBe(0)
  })
})

describe('useGenreDictionary — устаревший кэш', () => {
  it('рендерится сразу из кэша и обновляется в фоне ровно одним запросом', async () => {
    const calls = mockSuccess(['ужасы', 'фэнтези'])
    genreDictionaryCache.slot.set({
      items: ['старый жанр'],
      fetchedAt: now - DICTIONARY_TTL_MS - 1,
    })
    const wrapper = createStoreWrapper()

    const { result, rerender } = renderHook(() => useGenreDictionary(), {
      wrapper,
    })

    expect(result.current).toEqual([{ name: 'старый жанр' }])
    // Второй потребитель до ответа дедуплицируется RTK Query.
    renderHook(() => useGenreDictionary(), { wrapper })
    rerender()

    await waitFor(() => {
      expect(result.current).toEqual([{ name: 'ужасы' }, { name: 'фэнтези' }])
    })
    expect(calls.count).toBe(1)
  })
})

describe('useGenreDictionary — неудачный запрос', () => {
  it('остаётся на фолбэке и не повторяет запрос при ремаунте в пределах кулдауна', async () => {
    const calls = mockError(500)
    const wrapper = createStoreWrapper()

    const first = renderHook(() => useGenreDictionary(), { wrapper })
    await waitFor(() => {
      expect(calls.count).toBe(1)
    })
    expect(first.result.current).toEqual(STATIC_FALLBACK_GENRES)
    first.unmount()

    // RTK Query перезапускает упавший запрос на новой подписке — его глушит кулдаун.
    const second = renderHook(() => useGenreDictionary(), { wrapper })
    await flush()
    expect(calls.count).toBe(1)
    expect(second.result.current).toEqual(STATIC_FALLBACK_GENRES)
  })
})
