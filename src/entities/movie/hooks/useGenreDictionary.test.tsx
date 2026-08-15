import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import {
  genreDictionarySlot,
  GENRE_DICTIONARY_TTL_MS,
} from '../api/genreDictionaryCache'
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

let now = 1_000_000

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useGenreDictionary — пустой кэш', () => {
  it('первый рендер сразу отдаёт статический фолбэк, без ожидания сети', async () => {
    mockSuccess(['драма'])
    const { result } = renderHook(() => useGenreDictionary())

    expect(result.current).toEqual(STATIC_FALLBACK_GENRES)

    // Дожидаемся, чтобы фоновый фетч, запущенный этим тестом, полностью осел (in-flight
    // промис settled, слот записан) до конца теста — иначе он может дописать в
    // localStorage/module-state уже после того, как следующий тест начнёт выполняться
    // (см. глобальный afterEach в src/test/setup.ts, который чистит и то, и другое, но
    // только МЕЖДУ тестами).
    await waitFor(() => {
      expect(genreDictionarySlot.get().items).toEqual(['драма'])
    })
  })

  it('после успешного фонового фетча перерисовывается с данными из API', async () => {
    mockSuccess(['драма', 'боевик'])
    const { result } = renderHook(() => useGenreDictionary())

    await waitFor(() => {
      expect(result.current).toEqual([{ name: 'драма' }, { name: 'боевик' }])
    })
  })
})

describe('useGenreDictionary — свежий кэш', () => {
  it('рендерится сразу из кэша, фонового запроса не происходит', async () => {
    const calls = mockSuccess(['триллер'])
    genreDictionarySlot.set({ items: ['триллер'], fetchedAt: now })

    const { result, rerender } = renderHook(() => useGenreDictionary())

    expect(result.current).toEqual([{ name: 'триллер' }])
    rerender()
    rerender()

    // даём эффектам шанс сработать, если бы они (ошибочно) сделали запрос
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(calls.count).toBe(0)
  })
})

describe('useGenreDictionary — устаревший кэш', () => {
  it('рендерится сразу из кэша и происходит ровно один фоновый запрос при повторных ре-рендерах', async () => {
    const calls = mockSuccess(['ужасы', 'фэнтези'])
    genreDictionarySlot.set({
      items: ['старый жанр'],
      fetchedAt: now - GENRE_DICTIONARY_TTL_MS - 1,
    })

    const { result, rerender } = renderHook(() => useGenreDictionary())

    expect(result.current).toEqual([{ name: 'старый жанр' }])

    rerender()
    rerender()

    await waitFor(() => {
      expect(result.current).toEqual([{ name: 'ужасы' }, { name: 'фэнтези' }])
    })

    expect(calls.count).toBe(1)
  })
})

describe('useGenreDictionary — неудачный фоновый фетч', () => {
  it('не приводит к повторным запросам при последующих ре-рендерах в пределах cooldown', async () => {
    const calls = mockError(500)

    const { rerender } = renderHook(() => useGenreDictionary())

    await waitFor(() => {
      expect(calls.count).toBe(1)
    })

    rerender()
    rerender()

    await new Promise(resolve => setTimeout(resolve, 0))
    expect(calls.count).toBe(1)
  })
})
