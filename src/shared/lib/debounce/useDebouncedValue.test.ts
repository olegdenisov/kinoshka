import { renderHook } from '@testing-library/react'
import { act } from 'react'

import { useDebouncedValue } from './useDebouncedValue'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useDebouncedValue', () => {
  it('обновляет значение через 250ms тишины', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      {
        initialProps: { value: 'a' },
      },
    )

    expect(result.current).toBe('a')

    rerender({ value: 'ab' })
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(250))
    expect(result.current).toBe('ab')
  })

  it('схлопывает быстрые последовательные изменения — наружу уходит только финальное значение', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      {
        initialProps: { value: 'a' },
      },
    )

    rerender({ value: 'ab' })
    act(() => vi.advanceTimersByTime(100))
    rerender({ value: 'abc' })
    act(() => vi.advanceTimersByTime(100))
    rerender({ value: 'abcd' })

    // ещё не прошло 250ms тишины ни разу
    expect(result.current).toBe('a')

    act(() => vi.advanceTimersByTime(250))
    expect(result.current).toBe('abcd')
  })

  it('cleanup при размонтировании — таймер отменяется, повторный вызов setState не происходит', () => {
    const { rerender, unmount } = renderHook(
      ({ value }) => useDebouncedValue(value, 250),
      {
        initialProps: { value: 'a' },
      },
    )

    rerender({ value: 'ab' })
    unmount()

    expect(() => act(() => vi.advanceTimersByTime(250))).not.toThrow()
  })
})
