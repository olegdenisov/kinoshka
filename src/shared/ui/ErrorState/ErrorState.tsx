import type { ReactNode } from 'react'

import s from './ErrorState.module.css'

type Props = {
  title: string
  description: string
  onRetry?: () => void
  secondaryAction?: ReactNode
}

export const ErrorState = ({
  title,
  description,
  onRetry,
  secondaryAction,
}: Props) => {
  const hasActions = onRetry || secondaryAction

  return (
    <div className={s.wrap}>
      <p className={s.title}>{title}</p>
      <p className={s.description}>{description}</p>
      {hasActions && (
        <div className={s.actions}>
          {onRetry && (
            <button className={s.retryButton} onClick={onRetry} type='button'>
              Попробовать снова
            </button>
          )}
          {secondaryAction}
        </div>
      )}
    </div>
  )
}
