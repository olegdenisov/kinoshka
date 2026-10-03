import { type ReactNode, useRef } from 'react'

import { ErrorState } from '../ErrorState'
import { Spinner } from '../Spinner'

export type AsyncContentErrorParams = {
  error: Error
  // undefined без onRetry — дефолтный фолбэк тогда не рисует кнопку
  retry?: () => void
}

type AsyncContentProps = {
  pending: boolean
  error?: Error
  onRetry?: () => void
  fallback?: ReactNode
  errorFallback?: (params: AsyncContentErrorParams) => ReactNode
  children: ReactNode
}

const defaultErrorFallback = ({ error, retry }: AsyncContentErrorParams) => (
  <ErrorState
    title='Something went wrong'
    description={error.message || 'Please try again later'}
    onRetry={retry}
  />
)

// Презентационный: состояние запроса приходит пропсами, Reatom здесь не импортируется — так
// компонент остаётся в @shared/ui и не зависит от того, как ресурс устроен.
export const AsyncContent = ({
  pending,
  error,
  onRetry,
  fallback = <Spinner />,
  errorFallback = defaultErrorFallback,
  children,
}: AsyncContentProps) => {
  const isRetryingRef = useRef(false)

  if (pending) return fallback
  if (!error) return children

  // Защита от дабл-клика: два клика в одном синхронном тике (до перерисовки в pending)
  // запускают retry один раз. Гвард снимается микротаской, а не по смене error: повторная
  // попытка может упасть с тем же объектом ошибки, и сравнение по ссылке залипло бы навсегда.
  const retry = () => {
    if (isRetryingRef.current) return
    isRetryingRef.current = true
    queueMicrotask(() => {
      isRetryingRef.current = false
    })
    onRetry?.()
  }

  return errorFallback({ error, retry: onRetry ? retry : undefined })
}
