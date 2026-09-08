import * as Sentry from '@sentry/react'
import { ErrorState } from '@shared/ui'
import type { PropsWithChildren } from 'react'

// Глобальный boundary поверх всего дерева (см. providers.tsx) — отдельный компонент, а не правка
// shared/ui/ErrorBoundary: тот примитив уже держит на себе все точечные AsyncBoundary-секции
// (rails, /search, /movie/:id), трогать его ради Sentry — лишний blast radius (см. план
// docs/plans/20260905-sentry-error-tracking.md, Solution Overview). ErrorState — тот же UI
// фолбэк, что и у AsyncBoundary, для визуальной консистентности.
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
