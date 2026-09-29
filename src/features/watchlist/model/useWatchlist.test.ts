import { act, renderHook } from '@testing-library/react'

import { useWatchlist } from './useWatchlist'
import { watchlistSlot } from './watchlistStorage'

beforeEach(() => localStorage.clear())

afterEach(() => vi.restoreAllMocks())

describe('useWatchlist', () => {
  it('по умолчанию список пуст', () => {
    const { result } = renderHook(() => useWatchlist())

    expect(result.current.ids).toEqual([])
    expect(result.current.isInWatchlist(1)).toBe(false)
  })

  it('toggle добавляет отсутствующий id и убирает присутствующий', () => {
    const { result } = renderHook(() => useWatchlist())

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([1])
    expect(result.current.isInWatchlist(1)).toBe(true)

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([])
    expect(result.current.isInWatchlist(1)).toBe(false)
  })

  it('два toggle подряд в одном act не затирают друг друга', () => {
    const { result } = renderHook(() => useWatchlist())

    act(() => {
      result.current.toggle(1)
      result.current.toggle(2)
    })

    expect(result.current.ids).toEqual([1, 2])
  })

  it('toggle убирает один id из середины, порядок добавления сохраняется', () => {
    watchlistSlot.set([1, 2, 3])
    const { result } = renderHook(() => useWatchlist())

    act(() => result.current.toggle(2))
    expect(result.current.ids).toEqual([1, 3])

    act(() => result.current.toggle(2))
    expect(result.current.ids).toEqual([1, 3, 2])
  })

  it('два экземпляра хука синхронизируются через слот', () => {
    const first = renderHook(() => useWatchlist())
    const second = renderHook(() => useWatchlist())

    act(() => first.result.current.toggle(5))

    expect(second.result.current.ids).toEqual([5])
    expect(second.result.current.isInWatchlist(5)).toBe(true)
  })

  it('сохраняет в localStorage под ключом kinoshka:watchlist', () => {
    const { result } = renderHook(() => useWatchlist())

    act(() => result.current.toggle(7))

    expect(JSON.parse(localStorage.getItem('kinoshka:watchlist')!)).toEqual([7])
  })

  it('невалидное значение в storage → []', () => {
    localStorage.setItem('kinoshka:watchlist', JSON.stringify(['a', 'b']))

    const { result } = renderHook(() => useWatchlist())

    expect(result.current.ids).toEqual([])
  })

  it('недоступное хранилище: toggle не меняет состояние и не бросает', () => {
    const { result } = renderHook(() => useWatchlist())
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(() => act(() => result.current.toggle(1))).not.toThrow()
    expect(result.current.ids).toEqual([])
    expect(result.current.isInWatchlist(1)).toBe(false)
    expect(watchlistSlot.get()).toEqual([])
  })
})
