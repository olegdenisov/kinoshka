import type * as SharedLib from '@shared/lib'
import { act, renderHook } from '@testing-library/react'

import { useFavorites } from './useFavorites'

// Мокаем только trackEvent, остальные реальные экспорты @shared/lib (useStorageSlot и т.д.)
// сохраняем через vi.importActual — тот же паттерн, что useFilterState.test.tsx использует
// (Task 7).
vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

beforeEach(() => {
  localStorage.clear()
  vi.mocked(trackEvent).mockClear()
})

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

  it('toggle на отсутствующем id (добавление) вызывает trackEvent("favorite added")', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => result.current.toggle(1))

    expect(trackEvent).toHaveBeenCalledWith('favorite added')
    expect(trackEvent).toHaveBeenCalledTimes(1)
  })

  it('toggle на уже избранном id (удаление) НЕ вызывает trackEvent', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => result.current.toggle(1))
    vi.mocked(trackEvent).mockClear()

    act(() => result.current.toggle(1))

    expect(result.current.ids).toEqual([])
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('add() НЕ вызывает trackEvent — трекинг живёт только в ветке добавления toggle()', () => {
    const { result } = renderHook(() => useFavorites())

    act(() => result.current.add(1))

    expect(result.current.ids).toEqual([1])
    expect(trackEvent).not.toHaveBeenCalled()
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
