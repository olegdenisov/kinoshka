import { act, renderHook } from '@testing-library/react'

import { useTheme } from './useTheme'

// Переопределяет глобальный стаб window.matchMedia (src/test/setup.ts) для одного теста:
// нужный starting `matches` + доступ к сохранённому 'change'-листенеру, чтобы симулировать
// смену системной темы вручную (jsdom не эмулирует реальные medium-query события).
const mockMatchMedia = (matches: boolean) => {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: (
      type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener: (
      type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (type === 'change') listeners.delete(listener)
    },
  }))

  return {
    emitChange: (newMatches: boolean) => {
      listeners.forEach(listener =>
        listener({ matches: newMatches } as MediaQueryListEvent),
      )
    },
  }
}

beforeEach(() => {
  localStorage.clear()
  mockMatchMedia(false)
})

// jsdom document общий между тестами файла — без сброса data-theme, выставленный
// предыдущим тестом атрибут утёк бы в следующий (см. Task 4 плана).
afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('useTheme — persist и data-theme', () => {
  it('setTheme персистит значение в localStorage (JSON-строка)', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))

    expect(localStorage.getItem('kinoshka:theme')).toBe('"light"')
  })

  it('применяет data-theme на document.documentElement при изменении resolvedTheme', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('dark'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    act(() => result.current.setTheme('light'))

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('useTheme — toggleTheme', () => {
  it('переключает dark → light по текущему resolvedTheme', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('dark'))
    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('переключает light → dark по текущему resolvedTheme', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))
    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('из theme === system toggle даёт предсказуемый результат по resolvedTheme, а не raw theme', () => {
    mockMatchMedia(true) // prefersDark: true → system резолвится в dark
    const { result } = renderHook(() => useTheme())

    expect(result.current.theme).toBe('system')
    expect(result.current.resolvedTheme).toBe('dark')

    act(() => result.current.toggleTheme())

    expect(result.current.theme).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
  })
})

describe('useTheme — реакция на смену системной темы', () => {
  it('theme === system: matchMedia change-событие меняет resolvedTheme и data-theme', () => {
    const { emitChange } = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    expect(result.current.resolvedTheme).toBe('light')

    act(() => emitChange(true))

    expect(result.current.resolvedTheme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('theme !== system: matchMedia change-событие не влияет на resolvedTheme', () => {
    const { emitChange } = mockMatchMedia(false)
    const { result } = renderHook(() => useTheme())

    act(() => result.current.setTheme('light'))
    act(() => emitChange(true))

    expect(result.current.resolvedTheme).toBe('light')
  })
})
