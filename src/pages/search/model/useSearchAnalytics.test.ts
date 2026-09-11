import type * as SharedLib from '@shared/lib'
import { renderHook } from '@testing-library/react'
import { act } from 'react'

import { useSearchAnalytics } from './useSearchAnalytics'

// Мокаем только trackEvent, реальный useDebouncedValue сохраняем через vi.importActual — тот же
// паттерн, что AppLayout.test.tsx использует для trackPageview (Task 5).
vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(trackEvent).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useSearchAnalytics', () => {
  it('серия быстрых промежуточных значений схлопывается в один trackEvent после 800мс тишины', () => {
    // Стартуем с пустого query — `useDebouncedValue`'s начальное состояние равно первому
    // переданному значению без задержки (см. его докблок), поэтому старт сразу с непустого
    // query затрекал бы его немедленно, минуя дебаунс. Реалистичный сценарий (печать в поле
    // поиска) — переход от пустого к серии промежуточных непустых значений.
    const { rerender } = renderHook(({ query }) => useSearchAnalytics(query), {
      initialProps: { query: '' },
    })

    rerender({ query: 'ba' })
    act(() => vi.advanceTimersByTime(300))
    rerender({ query: 'batm' })
    act(() => vi.advanceTimersByTime(300))
    rerender({ query: 'batman' })

    // ещё не прошло 800мс тишины с последнего изменения
    expect(trackEvent).not.toHaveBeenCalled()

    act(() => vi.advanceTimersByTime(800))

    expect(trackEvent).toHaveBeenCalledTimes(1)
    expect(trackEvent).toHaveBeenCalledWith('search submitted')
  })

  it('повторный рендер с тем же query после устаканивания не трекает снова', () => {
    const { rerender } = renderHook(({ query }) => useSearchAnalytics(query), {
      initialProps: { query: 'batman' },
    })

    act(() => vi.advanceTimersByTime(800))
    expect(trackEvent).toHaveBeenCalledTimes(1)

    rerender({ query: 'batman' })
    act(() => vi.advanceTimersByTime(800))

    expect(trackEvent).toHaveBeenCalledTimes(1)
  })

  it('смена на другой непустой query (после устаканивания) трекает снова', () => {
    const { rerender } = renderHook(({ query }) => useSearchAnalytics(query), {
      initialProps: { query: 'batman' },
    })

    act(() => vi.advanceTimersByTime(800))
    expect(trackEvent).toHaveBeenCalledTimes(1)

    rerender({ query: 'superman' })
    act(() => vi.advanceTimersByTime(800))

    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it('переход в пустой query, затем обратно на тот же текст — трекает снова (реф сброшен)', () => {
    const { rerender } = renderHook(({ query }) => useSearchAnalytics(query), {
      initialProps: { query: 'batman' },
    })

    act(() => vi.advanceTimersByTime(800))
    expect(trackEvent).toHaveBeenCalledTimes(1)

    rerender({ query: '' })
    act(() => vi.advanceTimersByTime(800))
    expect(trackEvent).toHaveBeenCalledTimes(1)

    rerender({ query: 'batman' })
    act(() => vi.advanceTimersByTime(800))

    expect(trackEvent).toHaveBeenCalledTimes(2)
  })

  it('пустой query изначально — не трекает', () => {
    renderHook(({ query }) => useSearchAnalytics(query), {
      initialProps: { query: '' },
    })

    act(() => vi.advanceTimersByTime(800))

    expect(trackEvent).not.toHaveBeenCalled()
  })
})
