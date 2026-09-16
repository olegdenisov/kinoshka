import { initAnalytics, reportWebVitals } from '@shared/lib'
import { RouterProvider } from 'react-router/dom'

import { GlobalErrorBoundary } from './GlobalErrorBoundary'
import { router } from './router'

// initSentry() больше не вызывается здесь — переехал в src/app/sentry-bootstrap.ts, импортируемый
// первой строкой в main.tsx, раньше этого модуля (который транзитивно импортирует ./router и
// создаёт роутер) — см. WHY-комментарий в sentry-bootstrap.ts про требование порядка инициализации.
// Один раз на верхнем уровне модуля, до определения Providers — initAnalytics()/reportWebVitals()
// рано выходят, если !PROD || !VITE_PLAUSIBLE_DOMAIN (см. src/shared/lib/analytics/analytics.ts) —
// no-op в dev/test-окружениях.
initAnalytics()
reportWebVitals()

export const Providers = () => {
  return (
    <GlobalErrorBoundary>
      <RouterProvider router={router} />
    </GlobalErrorBoundary>
  )
}
