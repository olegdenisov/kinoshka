import { initAnalytics } from '@shared/lib'
import { Provider } from 'react-redux'
import { RouterProvider } from 'react-router/dom'

import { registerChunkPreloadRecovery } from './chunkPreloadRecovery'
import { GlobalErrorBoundary } from './GlobalErrorBoundary'
import { router } from './router'
import { store } from './store'

// initSentry() больше не вызывается здесь — переехал в src/app/sentry-bootstrap.ts, импортируемый
// первой строкой в main.tsx, раньше этого модуля (который транзитивно импортирует ./router и
// создаёт роутер) — см. WHY-комментарий в sentry-bootstrap.ts про требование порядка инициализации.
// reportWebVitals() удалён вместе с пайплайном Web Vitals→Plausible (2.5.7) — Web Vitals теперь
// собирает Sentry Performance (tracesSampleRate в src/app/sentry.ts), отдельный вызов не нужен.
// Один раз на верхнем уровне модуля, до определения Providers — initAnalytics() рано выходит,
// если !PROD || !VITE_PLAUSIBLE_DOMAIN (см. src/shared/lib/analytics/analytics.ts) — no-op в
// dev/test-окружениях. registerChunkPreloadRecovery() — тоже один раз на верхнем уровне: слушает
// window's vite:preloadError и перезагружает страницу при сбое загрузки чанка (не чаще раза в
// 10s, только в PROD — в dev обработчик ничего не делает, см. WHY в chunkPreloadRecovery.ts).
initAnalytics()
registerChunkPreloadRecovery()

export const Providers = () => {
  return (
    <GlobalErrorBoundary>
      <Provider store={store}>
        <RouterProvider router={router} />
      </Provider>
    </GlobalErrorBoundary>
  )
}
