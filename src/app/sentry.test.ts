import type { ErrorEvent as SentryErrorEvent } from '@sentry/react'
import * as Sentry from '@sentry/react'

import { initSentry, scrubApiKeyHeader } from './sentry'

vi.mock('@sentry/react', () => ({ init: vi.fn() }))

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
  })

  it('вырезает и lowercase-вариант x-api-key', () => {
    const event = {
      request: {
        headers: { 'x-api-key': 'secret', Accept: '*/*' },
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

    expect(Sentry.init).toHaveBeenCalledTimes(1)
    expect(Sentry.init).toHaveBeenCalledWith({
      dsn: 'https://example.test/1',
      release: __APP_RELEASE__,
      environment: import.meta.env.MODE,
      sendDefaultPii: false,
      beforeSend: scrubApiKeyHeader,
    })

    const config = (Sentry.init as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>
    expect(config).not.toHaveProperty('tracesSampleRate')
    expect(config).not.toHaveProperty('integrations')
  })
})
