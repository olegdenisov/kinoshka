import type { ReactNode } from 'react'

import { ErrorState } from '../ErrorState'
import { Spinner } from '../Spinner'

// Структурный тип результата RTK Query-хука: @shared/ui не импортирует RTK,
// поэтому принимает только нужные поля. Хук, собирающий такой результат вручную (из нескольких
// запросов или с пересчётом data), объявляет его как возвращаемый тип.
export type QueryBoundaryQuery<T> = {
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

type Props<T> = {
  query: QueryBoundaryQuery<T>
  fallback?: ReactNode
  errorFallback?: (params: QueryBoundaryErrorParams) => ReactNode
  children: (data: T) => ReactNode
}

const getErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const { message } = error
    if (typeof message === 'string' && message) return message
  }
  return 'Please try again later'
}

const defaultErrorFallback = ({ error, reset }: QueryBoundaryErrorParams) => (
  <ErrorState
    title='Something went wrong'
    description={getErrorMessage(error)}
    onRetry={reset}
  />
)

export const QueryBoundary = <T,>({
  query,
  fallback = <Spinner />,
  errorFallback = defaultErrorFallback,
  children,
}: Props<T>) => {
  const { data, isLoading, isError, error, refetch } = query

  // Ошибка важнее старых data: на main ошибка тоже заменяет контент, а
  // RTK Query при неудачном перезапросе оставляет прежние data.
  if (isError) {
    return errorFallback({
      error,
      reset: () => {
        refetch()
      },
    })
  }

  // data === undefined без ошибки — пропущенный/ещё не стартовавший запрос;
  // children никогда не получает undefined.
  if (isLoading || data === undefined) return fallback

  return children(data)
}
