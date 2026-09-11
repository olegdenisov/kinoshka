import { initAnalytics, reportWebVitals } from '@shared/lib'
import { RouterProvider } from 'react-router/dom'

import { GlobalErrorBoundary } from './GlobalErrorBoundary'
import { router } from './router'
import { initSentry } from './sentry'

// Один раз на верхнем уровне модуля, до определения Providers — initSentry() рано выходит, если
// !PROD || !VITE_SENTRY_DSN (см. src/app/sentry.ts), так что no-op в dev/test-окружениях.
initSentry()
// Аналогично initSentry(): initAnalytics()/reportWebVitals() рано выходят, если
// !PROD || !VITE_PLAUSIBLE_DOMAIN (см. src/shared/lib/analytics/analytics.ts) — no-op в dev/test.
initAnalytics()
reportWebVitals()

export const Providers = () => {
  return (
    <GlobalErrorBoundary>
      <RouterProvider router={router} />
    </GlobalErrorBoundary>
  )
}
