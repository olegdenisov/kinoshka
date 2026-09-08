import * as Sentry from '@sentry/react'

// Defense-in-depth: `X-API-KEY` (см. src/shared/api/client.ts) не должен попасть в Sentry, если
// когда-нибудь окажется в request-контексте события. При sendDefaultPii: false (дефолт SDK,
// зафиксирован явно в initSentry) браузерный SDK сам не прикладывает заголовки запроса к
// событию — так что это подстраховка на случай будущей интеграции/ручного контекста, а не
// закрытие уже существующей дыры.
export const scrubApiKeyHeader = (
  event: Sentry.ErrorEvent,
): Sentry.ErrorEvent => {
  const headers = event.request?.headers
  if (!headers) return event

  const scrubbedHeaders = { ...headers }
  delete scrubbedHeaders['X-API-KEY']
  delete scrubbedHeaders['x-api-key']

  return {
    ...event,
    request: {
      ...event.request,
      headers: scrubbedHeaders,
    },
  }
}

// Явная функция, а не side-effect при импорте — тестируема с разными import.meta.env.PROD /
// VITE_SENTRY_DSN через vi.stubEnv. Скоуп — только error tracking (см. план 20260905-sentry-
// error-tracking.md, Overview): без integrations/tracesSampleRate, трейсинг вне скоупа (2.5.2).
export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!import.meta.env.PROD || !dsn) return

  Sentry.init({
    dsn,
    release: __APP_RELEASE__,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend: scrubApiKeyHeader,
  })
}
