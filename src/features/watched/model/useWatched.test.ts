import { act, renderHook } from '@testing-library/react'

import { useWatched } from './useWatched'
import { watchedSlot } from './watchedStorage'

beforeEach(() => localStorage.clear())

afterEach(() => vi.restoreAllMocks())

describe('useWatched', () => {
  it('по умолчанию список пуст', () => {
    const { result } = renderHook(() => useWatched())

    expect(result.current.ids).toEqual([])
    expect(result.current.isWatched(1)).toBe(false)
  })

  it('toggle добавляет отсутствующий id и убирает присутствующий', () => {
    const { result } = renderHook(() => useWatched())

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([1])
    expect(result.current.isWatched(1)).toBe(true)

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([])
    expect(result.current.isWatched(1)).toBe(false)
  })

  it('два toggle подряд в одном act не затирают друг друга', () => {
    const { result } = renderHook(() => useWatched())

    act(() => {
      result.current.toggle(1)
      result.current.toggle(2)
    })

    expect(result.current.ids).toEqual([1, 2])
  })

  it('сохраняет в localStorage под ключом kinoshka:watched', () => {
    const { result } = renderHook(() => useWatched())

    act(() => result.current.toggle(7))

    expect(JSON.parse(localStorage.getItem('kinoshka:watched')!)).toEqual([7])
  })

  it('невалидное значение в storage → []', () => {
    localStorage.setItem('kinoshka:watched', JSON.stringify(['a', 'b']))

    const { result } = renderHook(() => useWatched())

    expect(result.current.ids).toEqual([])
  })

  it('недоступное хранилище: toggle не меняет состояние и не бросает', () => {
    const { result } = renderHook(() => useWatched())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(() => act(() => result.current.toggle(1))).not.toThrow()
    expect(result.current.ids).toEqual([])
    expect(result.current.isWatched(1)).toBe(false)
    expect(watchedSlot.get()).toEqual([])
  })
})
