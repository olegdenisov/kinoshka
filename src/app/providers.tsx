import { reatomComponent } from '@reatom/react'
import { initAnalytics } from '@shared/lib'

import { registerChunkPreloadRecovery } from './chunkPreloadRecovery'
import { GlobalErrorBoundary } from './GlobalErrorBoundary'
import { layoutRoute } from './routes'

// initSentry() больше не вызывается здесь — переехал в src/app/sentry-bootstrap.ts, импортируемый
// первой строкой в main.tsx, раньше этого модуля — см. WHY-комментарий в sentry-bootstrap.ts.
// reportWebVitals() удалён вместе с пайплайном Web Vitals→Plausible (2.5.7) — Web Vitals теперь
// собирает Sentry Performance (tracesSampleRate в src/app/sentry.ts), отдельный вызов не нужен.
// Один раз на верхнем уровне модуля, до определения Providers — initAnalytics() рано выходит,
// если !PROD || !VITE_PLAUSIBLE_DOMAIN (см. src/shared/lib/analytics/analytics.ts) — no-op в
// dev/test-окружениях. registerChunkPreloadRecovery() — тоже один раз на верхнем уровне: слушает
// window's vite:preloadError и перезагружает страницу при сбое загрузки чанка (не чаще раза в
// 10s, только в PROD — в dev обработчик ничего не делает, см. WHY в chunkPreloadRecovery.ts).
initAnalytics()
registerChunkPreloadRecovery()

// Обычный компонент здесь нельзя: React Compiler закэширует результат render(), и навигация
// перестанет перерисовывать дерево. Живёт здесь, а не в routes.tsx: файл с компонентом не должен
// экспортировать что-то кроме компонентов (react/only-export-components, fast refresh).
const RouterOutlet = reatomComponent(() => layoutRoute.render(), 'RouterOutlet')

// Обычный компонент: атомы читает RouterOutlet, а не Providers — иначе React Compiler
// закэшировал бы прочитанное значение.
export const Providers = () => {
  return (
    <GlobalErrorBoundary>
      <RouterOutlet />
    </GlobalErrorBoundary>
  )
}
