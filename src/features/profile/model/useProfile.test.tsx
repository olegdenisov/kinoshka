import { act, renderHook } from '@testing-library/react'

import { PROFILE_NAME_MAX_LENGTH } from './profileStorage'
import { useProfile } from './useProfile'

beforeEach(() => localStorage.clear())

// Страховка для тестов со spyOn(Storage.prototype, 'setItem'): если expect упадёт до
// inline spy.mockRestore(), бросающий spy иначе утёк бы в последующие тесты файла.
afterEach(() => vi.restoreAllMocks())

describe('useProfile', () => {
  it('начальное состояние: пустые name и initials', () => {
    const { result } = renderHook(() => useProfile())

    expect(result.current.name).toBe('')
    expect(result.current.initials).toBe('')
  })

  it('setName сохраняет имя, считает инициалы и пишет в localStorage', () => {
    const { result } = renderHook(() => useProfile())

    act(() => result.current.setName('Oleg Denisov'))

    expect(result.current.name).toBe('Oleg Denisov')
    expect(result.current.initials).toBe('OD')
    expect(localStorage.getItem('kinoshka:profile')).toBe(
      JSON.stringify('Oleg Denisov'),
    )
  })

  it('setName тримит вход', () => {
    const { result } = renderHook(() => useProfile())

    act(() => result.current.setName('  Oleg  '))

    expect(result.current.name).toBe('Oleg')
  })

  it.each(['', '   '])('setName(%j) сохраняет пустое имя', input => {
    const { result } = renderHook(() => useProfile())

    act(() => result.current.setName('Oleg'))
    act(() => result.current.setName(input))

    expect(result.current.name).toBe('')
    expect(result.current.initials).toBe('')
    expect(localStorage.getItem('kinoshka:profile')).toBe('""')
  })

  it.each(['\u200B', '\u200D\u200D', '\u00AD', '\u202E'])(
    'setName с невидимым вводом %j сохраняет пустое имя (не пустой кружок)',
    input => {
      const { result } = renderHook(() => useProfile())

      act(() => result.current.setName(input))

      expect(result.current.name).toBe('')
      expect(result.current.initials).toBe('')
      expect(localStorage.getItem('kinoshka:profile')).toBe('""')
    },
  )

  it('setName возвращает true при успешной записи и false, если хранилище недоступно', () => {
    const { result } = renderHook(() => useProfile())

    let ok = false
    act(() => {
      ok = result.current.setName('Oleg')
    })
    expect(ok).toBe(true)

    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
    act(() => {
      ok = result.current.setName('Ann')
    })
    spy.mockRestore()

    expect(ok).toBe(false)
    expect(result.current.name).toBe('Oleg')
  })

  it('смешанная BMP+астральная строка обрезается ровно по лимиту code points', () => {
    const { result } = renderHook(() => useProfile())
    const mixed = 'a😀'.repeat(PROFILE_NAME_MAX_LENGTH)

    act(() => result.current.setName(mixed))

    expect(Array.from(result.current.name)).toHaveLength(
      PROFILE_NAME_MAX_LENGTH,
    )
    expect(result.current.name).toBe(
      Array.from(mixed).slice(0, PROFILE_NAME_MAX_LENGTH).join(''),
    )
  })

  it('обрезка по лимиту, попавшая на пробел, не оставляет хвостовых пробелов и имя переживает чтение', () => {
    const { result } = renderHook(() => useProfile())

    act(() =>
      result.current.setName('a'.repeat(PROFILE_NAME_MAX_LENGTH - 1) + ' bcd'),
    )

    const expected = 'a'.repeat(PROFILE_NAME_MAX_LENGTH - 1)

    expect(result.current.name).toBe(expected)
    expect(result.current.initials).toBe('A')
    expect(localStorage.getItem('kinoshka:profile')).toBe(
      JSON.stringify(expected),
    )
  })

  it('setName в одном экземпляре хука виден в другом', () => {
    const first = renderHook(() => useProfile())
    const second = renderHook(() => useProfile())

    act(() => first.result.current.setName('Oleg'))

    expect(second.result.current.name).toBe('Oleg')
  })

  it('имя длиннее лимита обрезается по code points, не разрезая эмодзи', () => {
    const { result } = renderHook(() => useProfile())

    act(() => result.current.setName('😀'.repeat(PROFILE_NAME_MAX_LENGTH + 5)))

    expect(Array.from(result.current.name)).toHaveLength(
      PROFILE_NAME_MAX_LENGTH,
    )
    expect(result.current.name).toBe('😀'.repeat(PROFILE_NAME_MAX_LENGTH))
  })

  it('clearName сбрасывает имя и не ломает подписку', () => {
    const { result } = renderHook(() => useProfile())

    act(() => result.current.setName('Oleg'))
    act(() => result.current.clearName())

    expect(result.current.name).toBe('')
    expect(result.current.initials).toBe('')
    expect(localStorage.getItem('kinoshka:profile')).toBe('""')

    act(() => result.current.setName('Anna'))

    expect(result.current.name).toBe('Anna')
  })

  it('clearName возвращает true при успешной записи и false, если хранилище недоступно', () => {
    const { result } = renderHook(() => useProfile())
    act(() => result.current.setName('Oleg'))

    let ok = false
    act(() => {
      ok = result.current.clearName()
    })
    expect(ok).toBe(true)
    expect(result.current.name).toBe('')

    act(() => result.current.setName('Ann'))
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
    act(() => {
      ok = result.current.clearName()
    })
    spy.mockRestore()

    expect(ok).toBe(false)
    expect(result.current.name).toBe('Ann')
  })
})
