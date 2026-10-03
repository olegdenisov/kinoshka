import type { ErrorEvent as SentryErrorEvent } from '@sentry/react'
import * as Sentry from '@sentry/react'

import { SENTRY_TRACES_SAMPLE_RATE } from '../../sentry.config'
import {
  captureChunkLoadError,
  captureRouteError,
  initSentry,
  scrubApiKeyHeader,
  scrubProfileNameBreadcrumb,
  scrubProfileNameSpan,
} from './sentry'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureReactException: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({
    name: 'BrowserTracing',
  })),
}))

beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllEnvs())

describe('scrubApiKeyHeader', () => {
  it('вырезает X-API-KEY, остальные заголовки не трогает', () => {
    const event = {
      request: {
        headers: {
          'X-API-KEY': 'secret',
          'Content-Type': 'application/json',
        },
      },
    } as unknown as SentryErrorEvent

    const scrubbed = scrubApiKeyHeader(event)

    expect(scrubbed.request?.headers).toEqual({
      'Content-Type': 'application/json',
    })
    // не мутирует исходный event — в оригинальных headers X-API-KEY должен остаться
    expect(event.request?.headers).toEqual({
      'X-API-KEY': 'secret',
      'Content-Type': 'application/json',
    })
  })

  it('вырезает и lowercase-вариант x-api-key', () => {
    const event = {
      request: {
        headers: { 'x-api-key': 'secret', Accept: '*/*' },
      },
    } as unknown as SentryErrorEvent

    const scrubbed = scrubApiKeyHeader(event)

    expect(scrubbed.request?.headers).toEqual({ Accept: '*/*' })
    expect(event.request?.headers).toEqual({
      'x-api-key': 'secret',
      Accept: '*/*',
    })
  })

  it('вырезает обе регистровые вариации сразу, если присутствуют одновременно', () => {
    const event = {
      request: {
        headers: {
          'X-API-KEY': 'secret-upper',
          'x-api-key': 'secret-lower',
          Accept: '*/*',
        },
      },
    } as unknown as SentryErrorEvent

    const scrubbed = scrubApiKeyHeader(event)

    expect(scrubbed.request?.headers).toEqual({ Accept: '*/*' })
  })

  it('событие без request возвращается как есть, без исключения', () => {
    const event = { message: 'boom' } as unknown as SentryErrorEvent

    expect(() => scrubApiKeyHeader(event)).not.toThrow()
    expect(scrubApiKeyHeader(event)).toBe(event)
  })
})

describe('scrubProfileNameBreadcrumb', () => {
  it('вырезает имя из aria-label в ui.click-крошке', () => {
    const breadcrumb: Sentry.Breadcrumb = {
      category: 'ui.click',
      message: 'header > a.avatar[aria-label="Your profile: Ada Lovelace"]',
    }

    const scrubbed = scrubProfileNameBreadcrumb(breadcrumb)

    expect(scrubbed.message).toBe(
      'header > a.avatar[aria-label="Your profile: [redacted]',
    )
    expect(scrubbed.category).toBe('ui.click')
    expect(scrubbed.message).not.toContain('Ada')
    // не мутирует исходную крошку
    expect(breadcrumb.message).toContain('Ada Lovelace')
  })

  it('имя с кавычками, `]` и " > " не протекает в хвосте сообщения', () => {
    const scrubbed = scrubProfileNameBreadcrumb({
      category: 'ui.click',
      message:
        'a.avatar[aria-label="Your profile: A"] > B"] > svg.icon"] > span',
    })

    expect(scrubbed.message).toBe(
      'a.avatar[aria-label="Your profile: [redacted]',
    )
  })

  it('строка не из htmlTreeAsString (без окружающего селектора) не даёт битого хвоста', () => {
    const scrubbed = scrubProfileNameBreadcrumb({
      category: 'ui.click',
      message: 'Your profile: Ada Lovelace',
    })

    expect(scrubbed.message).toBe('Your profile: [redacted]')
  })

  it('крошки без имени профиля возвращаются как есть', () => {
    const plain = {
      category: 'ui.click',
      message: 'button.btn[aria-label="Add to favorites"]',
    }
    const noMessage = { category: 'navigation' }

    expect(scrubProfileNameBreadcrumb(plain)).toBe(plain)
    expect(scrubProfileNameBreadcrumb(noMessage)).toBe(noMessage)
  })

  it('aria-label без имени ("Your profile") не трогает', () => {
    const anon = {
      category: 'ui.click',
      message: 'a.avatar[aria-label="Your profile"]',
    }

    expect(scrubProfileNameBreadcrumb(anon)).toBe(anon)
  })
})

describe('scrubProfileNameSpan', () => {
  const baseSpan = {
    data: {},
    span_id: 'span-1',
    start_timestamp: 0,
    trace_id: 'trace-1',
  }

  it('вырезает имя из description span-а', () => {
    const span = {
      ...baseSpan,
      description: 'a.avatar[aria-label="Your profile: Ada Lovelace"]',
    }

    const scrubbed = scrubProfileNameSpan(span)

    expect(scrubbed.description).toBe(
      'a.avatar[aria-label="Your profile: [redacted]',
    )
    expect(scrubbed.description).not.toContain('Ada')
    // не мутирует исходный span
    expect(span.description).toContain('Ada Lovelace')
  })

  it('вырезает имя из строковых атрибутов span.data, не трогая остальные', () => {
    const span = {
      ...baseSpan,
      data: {
        'sentry.op': 'ui.interaction.click',
        target: 'a.avatar[aria-label="Your profile: Ada Lovelace"]',
      },
    }

    const scrubbed = scrubProfileNameSpan(span)

    expect(scrubbed.data.target).toBe(
      'a.avatar[aria-label="Your profile: [redacted]',
    )
    expect(scrubbed.data['sentry.op']).toBe('ui.interaction.click')
    // не мутирует исходные data
    expect(span.data.target).toContain('Ada Lovelace')
  })

  it('вырезает имя из строковых элементов массива-атрибута span.data, не трогая нестроковые элементы и остальные атрибуты', () => {
    const span = {
      ...baseSpan,
      data: {
        'sentry.op': 'ui.interaction.click',
        targets: [
          'a.avatar[aria-label="Your profile: Ada Lovelace"]',
          null,
          'div.footer',
        ],
      },
    }

    const scrubbed = scrubProfileNameSpan(span)

    expect(scrubbed.data.targets).toEqual([
      'a.avatar[aria-label="Your profile: [redacted]',
      null,
      'div.footer',
    ])
    expect(scrubbed.data['sentry.op']).toBe('ui.interaction.click')
    // не мутирует исходные data/массив
    expect((span.data.targets as string[])[0]).toContain('Ada Lovelace')
  })

  it('span без имени профиля возвращается как есть (та же ссылка)', () => {
    const span = {
      ...baseSpan,
      description: 'GET /v1.5/movie',
      data: { 'sentry.op': 'http.client' },
    }

    expect(scrubProfileNameSpan(span)).toBe(span)
  })
})

describe('initSentry', () => {
  it('PROD=false — Sentry.init не вызван, даже с непустым DSN', () => {
    vi.stubEnv('PROD', false)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.test/1')

    initSentry()

    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('PROD=true, пустой VITE_SENTRY_DSN — Sentry.init не вызван', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', '')

    initSentry()

    expect(Sentry.init).not.toHaveBeenCalled()
  })

  it('PROD=true, непустой VITE_SENTRY_DSN — Sentry.init вызван ровно один раз с ожидаемым конфигом', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.test/1')

    initSentry()

    expect(vi.mocked(Sentry.init)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.init)).toHaveBeenCalledWith({
      dsn: 'https://example.test/1',
      release: __APP_RELEASE__,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      beforeSend: scrubApiKeyHeader,
      beforeBreadcrumb: scrubProfileNameBreadcrumb,
      beforeSendSpan: scrubProfileNameSpan,
      integrations: [{ name: 'BrowserTracing' }],
      tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    })
  })

  it('авто-спаны pageload/navigation выключены — их создаёт initRouteTracing', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.test/1')

    initSentry()

    expect(vi.mocked(Sentry.browserTracingIntegration)).toHaveBeenCalledWith({
      instrumentPageLoad: false,
      instrumentNavigation: false,
    })
  })

  it('tracePropagationTargets НЕ присутствует среди ключей вызова Sentry.init', () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.test/1')

    initSentry()

    const callArgs = vi.mocked(Sentry.init).mock.calls[0]?.[0]
    expect(callArgs).toBeDefined()
    expect(Object.keys(callArgs ?? {})).not.toContain('tracePropagationTargets')
  })
})

describe('captureRouteError', () => {
  it('делегирует в Sentry.captureReactException с ошибкой и errorInfo', () => {
    const error = new Error('Route render failed')
    const errorInfo = {
      componentStack: 'ComponentA > ComponentB > ComponentC',
    }

    captureRouteError(error, errorInfo)

    expect(Sentry.captureReactException).toHaveBeenCalledTimes(1)
    expect(Sentry.captureReactException).toHaveBeenCalledWith(error, errorInfo)
  })
})

describe('captureChunkLoadError', () => {
  it('отправляет исходную ошибку загрузки чанка с тегом chunk_load', () => {
    const error = new Error('Failed to fetch dynamically imported module')

    captureChunkLoadError(error)

    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { chunk_load: 'reload' },
    })
  })
})
