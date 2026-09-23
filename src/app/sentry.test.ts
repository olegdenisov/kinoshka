import type { ErrorEvent as SentryErrorEvent } from '@sentry/react'
import * as Sentry from '@sentry/react'
import { setStorageErrorReporter } from '@shared/lib'

import { SENTRY_TRACES_SAMPLE_RATE } from '../../sentry.config'
import {
  initSentry,
  scrubApiKeyHeader,
  scrubProfileNameBreadcrumb,
  scrubProfileNameSpan,
} from './sentry'

vi.mock('@sentry/react', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  reactRouterBrowserTracingIntegration: vi.fn(() => ({
    name: 'ReactRouterBrowserTracing',
  })),
  wrapCreateBrowserRouter: vi.fn(fn => fn),
}))

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  vi.unstubAllEnvs()
  // initSentry() подключает реальный репортер в module-global хранилище — без сброса он остался бы
  // установленным для всех последующих тестов файла (order-dependent состояние)
  setStorageErrorReporter(() => {})
})

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
      integrations: [{ name: 'ReactRouterBrowserTracing' }],
      tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
    })
  })

  // Сквозной тест, не мок setStorageErrorReporter: @shared/lib здесь не замокан, только
  // '@sentry/react' — так что это реальная связка storage.ts → sentry.ts → Sentry.captureException,
  // а не проверка, что нужная функция просто была передана куда-то.
  it('подключает репортер ошибок localStorage: сбой createStorageSlot.set доходит до Sentry.captureException', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.test/1')
    initSentry()

    const { createStorageSlot } = await import('@shared/lib')
    const { z } = await import('zod')
    const slot = createStorageSlot(
      'sentry-wiring-test',
      z.array(z.number()),
      [],
    )
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })

    slot.set([1])
    spy.mockRestore()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    const [sentError, sentContext] = vi.mocked(Sentry.captureException).mock
      .calls[0]!
    // jsdom's DOMException не является instanceof Error (в реальном браузере — является) —
    // reportStorageErrorToSentry на этот случай оборачивает в new Error(String(error)), так что
    // здесь проверяем именно это защитное поведение, а не точный класс исключения.
    expect(sentError).toBeInstanceOf(Error)
    expect((sentError as Error).message).toContain('QuotaExceededError')
    expect(sentContext).toEqual({
      level: 'warning',
      tags: { storageKey: 'sentry-wiring-test', storageOperation: 'set' },
    })
  })

  it('репортер ошибок localStorage передаёт настоящий Error в captureException как есть', async () => {
    vi.stubEnv('PROD', true)
    vi.stubEnv('VITE_SENTRY_DSN', 'https://example.test/1')
    initSentry()

    const { createStorageSlot } = await import('@shared/lib')
    const { z } = await import('zod')
    const slot = createStorageSlot(
      'sentry-wiring-real-error',
      z.array(z.number()),
      [],
    )
    const original = new Error('quota')
    const spy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw original
      })

    slot.set([1])
    spy.mockRestore()

    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
    expect(vi.mocked(Sentry.captureException).mock.calls[0]![0]).toBe(original)
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
