import { Suspense, useRef, type ReactNode } from 'react'

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
  onRetry?: () => void
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
  onRetry,
}: Props) {
  const isRetryingRef = useRef(false)

  const wrappedFallback = ({ error, reset }: ErrorFallbackParams) => {
    // Любой рендер фолбэка (первая ошибка, повтор той же ошибки после неудачного
    // retry, или новая ошибка) означает, что предыдущая попытка retry — если она
    // была — уже дошла до какого-то исхода и полностью зафиксирована в дереве.
    // Гвард снимается безусловно, а не по сравнению ссылок на error: реальные
    // фетчеры (createCachedFetcher/getMoviesPage) кэшируют rejected-промис, и
    // повторный поход в кэш может вернуть ТОТ ЖЕ Error-объект по ссылке (напр.
    // getMoviesPage инвалидирует только первый шаг курсора — промежуточный шаг
    // при повторном retry способен вернуть один и тот же закэшированный rejected-
    // промис). Сравнение по ссылке на error раньше не переармировывало гвард в
    // этом случае — Retry становился нерабочим навсегда, а не просто ждал cooldown.
    //
    // Настоящую защиту от дабл-клика (два guardedReset() в одном синхронном тике,
    // до того как React вообще успел что-то закоммитить) даёт исключительно
    // instant-флаг ниже: isRetryingRef ставится в true ДО вызова onRetry/reset,
    // так что реентерантный вызов в том же тике гарантированно видит true и
    // выходит рано — единственная возможная "гонка" в однопоточном JS.
    isRetryingRef.current = false

    const guardedReset = () => {
      if (isRetryingRef.current) return
      isRetryingRef.current = true
      onRetry?.()
      reset()
    }

    return errorFallback({ error, reset: guardedReset })
  }

  return (
    <ErrorBoundary fallback={wrappedFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}
