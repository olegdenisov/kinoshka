import type * as SharedLib from '@shared/lib'
import { act, renderHook, waitFor } from '@testing-library/react'

import { createStoreWrapper, makeStore } from '../../../test/renderWithStore'
import { favoritesSlot } from './favoritesStorage'
import { useFavorites } from './useFavorites'

// Мокаем только trackEvent, остальные реальные экспорты @shared/lib (createStorageSlot и т.д.)
// сохраняем через importOriginal.
vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

beforeEach(() => {
  localStorage.clear()
  vi.mocked(trackEvent).mockClear()
})

// Страховка для тестов со spyOn(Storage.prototype, 'setItem'): если expect упадёт до восстановления,
// бросающий spy иначе утёк бы в последующие тесты файла.
afterEach(() => vi.restoreAllMocks())

const failWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('full', 'QuotaExceededError')
  })

describe('useFavorites — успешные сценарии', () => {
  it('по умолчанию список пуст', () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current.ids).toEqual([])
    expect(result.current.isFavorite(1)).toBe(false)
  })

  it('toggle добавляет отсутствующий id и убирает присутствующий', () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([1])
    expect(result.current.isFavorite(1)).toBe(true)

    act(() => result.current.toggle(1))
    expect(result.current.ids).toEqual([])
    expect(result.current.isFavorite(1)).toBe(false)
  })

  it('toggle сохраняет в localStorage под ключом kinoshka:favorites', () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    act(() => result.current.toggle(7))

    expect(JSON.parse(localStorage.getItem('kinoshka:favorites')!)).toEqual([7])
  })

  it('toggle на отсутствующем id (добавление) вызывает trackEvent("favorite added")', async () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    act(() => result.current.toggle(1))

    await waitFor(() =>
      expect(trackEvent).toHaveBeenCalledWith('favorite added'),
    )
    expect(trackEvent).toHaveBeenCalledTimes(1)
  })

  it('toggle на уже избранном id (удаление) НЕ вызывает trackEvent', async () => {
    favoritesSlot.set([1])
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    await act(async () => result.current.toggle(1))

    expect(result.current.ids).toEqual([])
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('два toggle подряд в одном act не затирают друг друга', () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    act(() => {
      result.current.toggle(1)
      result.current.toggle(2)
    })

    expect(result.current.ids).toEqual([1, 2])
    expect(favoritesSlot.get()).toEqual([1, 2])
  })

  it('два экземпляра хука на одном сторе видят одно состояние', () => {
    const store = makeStore()
    const first = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(store),
    })
    const second = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(store),
    })

    act(() => first.result.current.toggle(5))

    expect(second.result.current.ids).toEqual([5])
  })
})

describe('useFavorites — отказ записи', () => {
  it('toggle при недоступном хранилище откатывает стейт и НЕ вызывает trackEvent', async () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })
    failWrites()

    act(() => result.current.toggle(1))

    await waitFor(() => expect(result.current.ids).toEqual([]))
    expect(favoritesSlot.get()).toEqual([])
    expect(trackEvent).not.toHaveBeenCalled()
  })
})

describe('useFavorites — edge cases', () => {
  it('невалидный JSON в localStorage — ids начинается с [] (fallback, не падает)', () => {
    localStorage.setItem('kinoshka:favorites', 'not-json')

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current.ids).toEqual([])
  })

  it('несовпадение zod-схемы в localStorage — ids начинается с [] (fallback)', () => {
    localStorage.setItem('kinoshka:favorites', JSON.stringify(['a', 'b']))

    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

    expect(result.current.ids).toEqual([])
  })

  it('cross-tab sync — StorageEvent с нужным key отражается в хуке', () => {
    const { result } = renderHook(() => useFavorites(), {
      wrapper: createStoreWrapper(),
    })

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
