import type { ErrorEvent as SentryErrorEvent } from '@sentry/react'
import * as Sentry from '@sentry/react'

import { initSentry, scrubApiKeyHeader } from './sentry'

vi.mock('@sentry/react', () => ({ init: vi.fn() }))

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
    })
  })
})
