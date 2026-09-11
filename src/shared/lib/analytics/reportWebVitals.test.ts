import type { Metric } from 'web-vitals'

const onLCP = vi.fn()
const onINP = vi.fn()
const onCLS = vi.fn()
const trackEvent = vi.fn()
const isAnalyticsEnabled = vi.fn()

vi.mock('web-vitals', () => ({ onLCP, onINP, onCLS }))
vi.mock('./analytics', () => ({ trackEvent, isAnalyticsEnabled }))

// `reported`-флаг в reportWebVitals.ts — модульный, поэтому каждый тест переиспользующий
// поведение "первый вызов регистрирует колбэки" требует свежего инстанса модуля —
// vi.resetModules() + динамический re-import (тот же паттерн, что providers.test.tsx).
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
})

describe('reportWebVitals', () => {
  it('аналитика выключена — ни один on* не вызван', async () => {
    isAnalyticsEnabled.mockReturnValue(false)
    const { reportWebVitals } = await import('./reportWebVitals')

    reportWebVitals()
    await vi.dynamicImportSettled()

    expect(onLCP).not.toHaveBeenCalled()
    expect(onINP).not.toHaveBeenCalled()
    expect(onCLS).not.toHaveBeenCalled()
  })

  it('аналитика включена — все три колбэка зарегистрированы ровно по разу', async () => {
    isAnalyticsEnabled.mockReturnValue(true)
    const { reportWebVitals } = await import('./reportWebVitals')

    reportWebVitals()
    await vi.dynamicImportSettled()

    expect(onLCP).toHaveBeenCalledTimes(1)
    expect(onINP).toHaveBeenCalledTimes(1)
    expect(onCLS).toHaveBeenCalledTimes(1)
  })

  it('повторный вызов в том же инстансе модуля не регистрирует колбэки повторно', async () => {
    isAnalyticsEnabled.mockReturnValue(true)
    const { reportWebVitals } = await import('./reportWebVitals')

    reportWebVitals()
    await vi.dynamicImportSettled()
    reportWebVitals()
    await vi.dynamicImportSettled()

    expect(onLCP).toHaveBeenCalledTimes(1)
    expect(onINP).toHaveBeenCalledTimes(1)
    expect(onCLS).toHaveBeenCalledTimes(1)
  })

  it('CLS-callback: домножает value на 1000 перед округлением, шлёт "web vital: cls"', async () => {
    isAnalyticsEnabled.mockReturnValue(true)
    const { reportWebVitals } = await import('./reportWebVitals')

    reportWebVitals()
    await vi.dynamicImportSettled()

    const clsCallback = onCLS.mock.calls[0]?.[0] as (metric: Metric) => void
    clsCallback({
      name: 'CLS',
      value: 0.123,
      rating: 'good',
    } as Metric)

    expect(trackEvent).toHaveBeenCalledWith('web vital: cls', {
      value: 123,
      rating: 'good',
    })
  })

  it('LCP-callback: не домножает value, шлёт "web vital: lcp"', async () => {
    isAnalyticsEnabled.mockReturnValue(true)
    const { reportWebVitals } = await import('./reportWebVitals')

    reportWebVitals()
    await vi.dynamicImportSettled()

    const lcpCallback = onLCP.mock.calls[0]?.[0] as (metric: Metric) => void
    lcpCallback({
      name: 'LCP',
      value: 2500.4,
      rating: 'needs-improvement',
    } as Metric)

    expect(trackEvent).toHaveBeenCalledWith('web vital: lcp', {
      value: 2500,
      rating: 'needs-improvement',
    })
  })

  it('сбой динамического импорта web-vitals (напр. ad-blocker/сеть) — не роняет процесс необработанным rejection, логирует ошибку и откатывает reported для повторной попытки', async () => {
    isAnalyticsEnabled.mockReturnValue(true)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.doMock('web-vitals', () => {
      throw new Error('chunk load failed')
    })

    const { reportWebVitals } = await import('./reportWebVitals')
    reportWebVitals()
    await vi.dynamicImportSettled()

    expect(consoleError).toHaveBeenCalledWith(
      '[web-vitals] failed to load',
      expect.any(Error),
    )
    expect(onLCP).not.toHaveBeenCalled()

    // `reported` откатился после неудачи — следующий вызов пробует загрузку снова
    // (а не молча остаётся навсегда отключённым до перезагрузки страницы).
    vi.doMock('web-vitals', () => ({ onLCP, onINP, onCLS }))
    reportWebVitals()
    await vi.dynamicImportSettled()

    expect(onLCP).toHaveBeenCalledTimes(1)
    expect(onINP).toHaveBeenCalledTimes(1)
    expect(onCLS).toHaveBeenCalledTimes(1)

    consoleError.mockRestore()
  })

  it('INP-callback: не домножает value, шлёт "web vital: inp"', async () => {
    isAnalyticsEnabled.mockReturnValue(true)
    const { reportWebVitals } = await import('./reportWebVitals')

    reportWebVitals()
    await vi.dynamicImportSettled()

    const inpCallback = onINP.mock.calls[0]?.[0] as (metric: Metric) => void
    inpCallback({
      name: 'INP',
      value: 199.6,
      rating: 'good',
    } as Metric)

    expect(trackEvent).toHaveBeenCalledWith('web vital: inp', {
      value: 200,
      rating: 'good',
    })
  })
})
