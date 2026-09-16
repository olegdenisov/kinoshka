import * as Sentry from '@sentry/react'
import { useEffect } from 'react'
import {
  createRoutesFromChildren,
  matchRoutes,
  useLocation,
  useNavigationType,
} from 'react-router'

import { SENTRY_TRACES_SAMPLE_RATE } from '../../sentry.config'

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
// VITE_SENTRY_DSN через vi.stubEnv. Изначально (план 20260905-sentry-error-tracking.md) скоуп
// был только error tracking, без integrations/tracesSampleRate — трейсинг (2.5.2) сознательно
// не включался из-за параметризованного роута /movie/:id (риск одного transaction на фильм).
// Task 2b (план 20260915-telemetry-dashboard-sentry-alerts.md) закрывает этот блокер через
// reactRouterBrowserTracingIntegration + wrapCreateBrowserRouter (см. router.tsx) — они вместе
// группируют параметризованные роуты в один transaction name.
//
// tracePropagationTargets НЕ передаётся: дефолт SDK матчит только same-origin/localhost, а все
// вызовы API идут на абсолютный кросс-origin https://api.poiskkino.dev — заголовки sentry-trace/
// baggage туда и так не уйдут при дефолте, расширять список смысла нет, пока не понадобится и не
// будет проверено живым запросом на CORS-совместимость стороннего API (см. план, Post-Completion).
export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!import.meta.env.PROD || !dsn) return

  Sentry.init({
    dsn,
    release: __APP_RELEASE__,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    beforeSend: scrubApiKeyHeader,
    integrations: [
      Sentry.reactRouterBrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
    ],
    tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  })
}
