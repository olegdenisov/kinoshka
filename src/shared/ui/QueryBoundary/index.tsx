import type { ReactNode } from 'react'

import { ErrorState } from '../ErrorState'
import { Spinner } from '../Spinner'

// Структурный тип: подходит любому query-результату, без импорта zustand
type QueryLike<T> = {
  data?: T
  isLoading: boolean
  isError: boolean
  error?: unknown
  refetch: () => unknown
}

export type QueryBoundaryErrorParams = {
  error: unknown
  reset: () => void
}

type QueryBoundaryProps<T> = {
  query: QueryLike<T>
  fallback?: ReactNode
  errorFallback?: (params: QueryBoundaryErrorParams) => ReactNode
  children: (data: T) => ReactNode
}

const defaultErrorFallback = ({ error, reset }: QueryBoundaryErrorParams) => (
  <ErrorState
    title='Something went wrong'
    description={
      (error instanceof Error && error.message) || 'Please try again later'
    }
    onRetry={reset}
  />
)

export const QueryBoundary = <T,>({
  query,
  fallback = <Spinner />,
  errorFallback = defaultErrorFallback,
  children,
}: QueryBoundaryProps<T>) => {
  // Ошибка важнее старых данных: ошибка перезапроса не должна прятаться за устаревшей выдачей
  if (query.isError) {
    return errorFallback({
      error: query.error,
      reset: () => {
        query.refetch()
      },
    })
  }

  // data === undefined и не loading (пропущенный запрос) — тоже fallback,
  // чтобы children никогда не получал undefined
  if (query.isLoading || query.data === undefined) return fallback

  return children(query.data)
}
