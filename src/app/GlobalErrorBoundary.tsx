import * as Sentry from '@sentry/react'
import { ErrorState } from '@shared/ui'
import type { PropsWithChildren } from 'react'

// Глобальный boundary поверх всего дерева (см. providers.tsx) — отдельный компонент на
// Sentry.ErrorBoundary, а не переиспользование shared/ui/ErrorBoundary: примитив по плану
// 20260916-per-route-error-boundaries.md получил опциональный onError и используется per-route
// границей в AppLayout, но сюда, снаружи <RouterProvider>, тот механизм не подключить — здесь
// нет собственного роутинга/pathname для key-сброса, а Sentry.ErrorBoundary сам репортит
// пойманные ошибки. ErrorState — тот же UI фолбэк, что и у per-route границы, для
// визуальной консистентности.
export const GlobalErrorBoundary = ({ children }: PropsWithChildren) => (
  <Sentry.ErrorBoundary
    fallback={({ resetError }) => (
      <ErrorState
        title='Something went wrong'
        description='An unexpected error occurred. Please try again.'
        onRetry={resetError}
      />
    )}
  >
    {children}
  </Sentry.ErrorBoundary>
)
