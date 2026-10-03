import { reatomComponent } from '@reatom/react'
import { initAnalytics } from '@shared/lib'

import { registerChunkPreloadRecovery } from './chunkPreloadRecovery'
import { GlobalErrorBoundary } from './GlobalErrorBoundary'
import { layoutRoute } from './routes'

// Один раз на верхнем уровне модуля: initAnalytics() — no-op вне PROD / без VITE_PLAUSIBLE_DOMAIN;
// registerChunkPreloadRecovery() слушает vite:preloadError (детали — в chunkPreloadRecovery.ts).
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
