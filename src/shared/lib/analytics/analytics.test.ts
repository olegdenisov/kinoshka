import {
  initAnalytics,
  isAnalyticsEnabled,
  trackEvent,
  trackPageview,
} from './analytics'

afterEach(() => {
  document.getElementById('plausible-analytics-script')?.remove()
  delete (window as { plausible?: unknown }).plausible
  vi.unstubAllEnvs()
})

describe('isAnalyticsEnabled', () => {
  it('PROD=false — false, даже с непустым доменом', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')

    expect(isAnalyticsEnabled()).toBe(false)
  })

  it('PROD=true, пустой VITE_PLAUSIBLE_DOMAIN — false', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', '')

    expect(isAnalyticsEnabled()).toBe(false)
  })

  it('PROD=true, непустой VITE_PLAUSIBLE_DOMAIN — true', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')

    expect(isAnalyticsEnabled()).toBe(true)
  })
})

describe('initAnalytics', () => {
  it('PROD=false — скрипт не создан, стаб не установлен', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')

    initAnalytics()

    expect(document.getElementById('plausible-analytics-script')).toBeNull()
    expect(window.plausible).toBeUndefined()
  })

  it('PROD=true, пустой домен — скрипт не создан', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', '')

    initAnalytics()

    expect(document.getElementById('plausible-analytics-script')).toBeNull()
    expect(window.plausible).toBeUndefined()
  })

  it('PROD=true + домен — <script> с верными src/data-domain/defer, стаб установлен синхронно', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')

    initAnalytics()

    const script = document.getElementById(
      'plausible-analytics-script',
    ) as HTMLScriptElement | null

    expect(script).not.toBeNull()
    expect(script?.src).toBe('https://plausible.io/js/script.manual.js')
    expect(script?.dataset.domain).toBe('example.com')
    expect(script?.defer).toBe(true)
    expect(typeof window.plausible).toBe('function')
  })

  it('повторный вызов не создаёт второй <script>', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')

    initAnalytics()
    initAnalytics()

    expect(
      document.querySelectorAll('#plausible-analytics-script'),
    ).toHaveLength(1)
  })

  it('вызовы до загрузки реального скрипта складываются в window.plausible.q', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')

    initAnalytics()
    trackEvent('foo')
    trackPageview()

    expect(window.plausible?.q).toHaveLength(2)
  })
})

describe('trackEvent', () => {
  it('window.plausible не задан — не бросает исключение', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')

    expect(() => trackEvent('foo')).not.toThrow()
  })

  it('аналитика включена, window.plausible — vi.fn — вызван с ожидаемыми (name, options)', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')
    const plausible = vi.fn()
    window.plausible = plausible as Window['plausible']

    trackEvent('filter changed')
    trackEvent('search submitted', { foo: 'bar' })

    expect(plausible).toHaveBeenNthCalledWith(1, 'filter changed', undefined)
    expect(plausible).toHaveBeenNthCalledWith(2, 'search submitted', {
      props: { foo: 'bar' },
    })
  })

  it('props={} (пустой объект, truthy в JS) — передаётся как { props: {} }, не как undefined', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')
    const plausible = vi.fn()
    window.plausible = plausible as Window['plausible']

    trackEvent('foo', {})

    expect(plausible).toHaveBeenCalledWith('foo', { props: {} })
  })

  it('аналитика выключена (!PROD) — window.plausible не вызван, даже если определена', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')
    const plausible = vi.fn()
    window.plausible = plausible as Window['plausible']

    trackEvent('foo')

    expect(plausible).not.toHaveBeenCalled()
  })
})

describe('trackPageview', () => {
  it('вызывает trackEvent с зарезервированным именем pageview', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', 'example.com')
    const plausible = vi.fn()
    window.plausible = plausible as Window['plausible']

    trackPageview()

    expect(plausible).toHaveBeenCalledWith('pageview', undefined)
  })
})
