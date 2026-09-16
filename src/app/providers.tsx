import { initAnalytics } from '@shared/lib'
import { RouterProvider } from 'react-router/dom'

import { GlobalErrorBoundary } from './GlobalErrorBoundary'
import { router } from './router'

// initSentry() больше не вызывается здесь — переехал в src/app/sentry-bootstrap.ts, импортируемый
// первой строкой в main.tsx, раньше этого модуля (который транзитивно импортирует ./router и
// создаёт роутер) — см. WHY-комментарий в sentry-bootstrap.ts про требование порядка инициализации.
// reportWebVitals() удалён вместе с пайплайном Web Vitals→Plausible (2.5.7) — Web Vitals теперь
// собирает Sentry Performance (tracesSampleRate в src/app/sentry.ts), отдельный вызов не нужен.
// Один раз на верхнем уровне модуля, до определения Providers — initAnalytics() рано выходит,
// если !PROD || !VITE_PLAUSIBLE_DOMAIN (см. src/shared/lib/analytics/analytics.ts) — no-op в
// dev/test-окружениях.
initAnalytics()

export const Providers = () => {
  return (
    <GlobalErrorBoundary>
      <RouterProvider router={router} />
    </GlobalErrorBoundary>
  )
}
