import { act, renderHook } from '@testing-library/react'

import { useFavorites } from './useFavorites'

beforeEach(() => localStorage.clear())

describe('useFavorites — успешные сценарии', () => {
  it('add добавляет id в ids и isFavorite начинает возвращать true', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => result.current.add(1))

    expect(result.current.ids).toEqual([1])
    expect(result.current.isFavorite(1)).toBe(true)
  })

  it('remove убирает id из ids', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => result.current.add(1))
    act(() => result.current.remove(1))

    expect(result.current.ids).toEqual([])
    expect(result.current.isFavorite(1)).toBe(false)
  })

  it('toggle добавляет отсутствующий id и убирает присутствующий', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([1])

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([])
  })

  it('повторный add того же id не создаёт дубликат', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => result.current.add(1))
    act(() => result.current.add(1))

    expect(result.current.ids).toEqual([1])
  })

  it('повторный toggle не задваивает добавление в рамках одного вызова состояния', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => {
      result.current.add(1)
      result.current.add(1)
    })

    expect(result.current.ids).toEqual([1])
  })

  it('clear опустошает список', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => {
      result.current.add(1)
      result.current.add(2)
    })
    act(() => result.current.clear())

    expect(result.current.ids).toEqual([])
  })
})

describe('useFavorites — edge cases', () => {
  it('невалидный JSON в localStorage — ids начинается с [] (fallback, не падает)', () => {
    localStorage.setItem('kinoshka:favorites', 'not-json')

    const { result } = renderHook(() => useFavorites())

    expect(result.current.ids).toEqual([])
  })

  it('несовпадение zod-схемы в localStorage — ids начинается с [] (fallback)', () => {
    localStorage.setItem('kinoshka:favorites', JSON.stringify(['a', 'b']))

    const { result } = renderHook(() => useFavorites())

    expect(result.current.ids).toEqual([])
  })

  it('cross-tab sync — StorageEvent с нужным key отражается в хуке', () => {
    const { result } = renderHook(() => useFavorites())

    // Пишем напрямую в localStorage, минуя favoritesSlot.set() (который сам эмитит
    // локальное 'change'-событие) — иначе ассерт проходит из-за локального эмиттера,
    // а не из-за реального StorageEvent-листенера, который эмулирует другую вкладку.
    act(() => {
      localStorage.setItem('kinoshka:favorites', JSON.stringify([1, 2, 3]))
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'kinoshka:favorites',
          newValue: JSON.stringify([1, 2, 3]),
        }),
      )
    })

    expect(result.current.ids).toEqual([1, 2, 3])
  })
})
