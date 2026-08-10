import { Suspense, type ReactNode } from 'react'
import { ErrorBoundary } from '../ErrorBoundary'
import { ErrorState } from '../ErrorState'
import { Spinner } from '../Spinner'

export type ErrorFallbackParams = {
  error: Error | null
  reset: () => void
}

type Props = {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: (params: ErrorFallbackParams) => ReactNode
}

const defaultErrorFallback = ({ error, reset }: ErrorFallbackParams) => (
  <ErrorState
    title='Something went wrong'
    description={error?.message || 'Please try again later'}
    onRetry={reset}
  />
)

export function AsyncBoundary({
  children,
  fallback = <Spinner />,
  errorFallback = defaultErrorFallback,
}: Props) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}
