import s from './ErrorState.module.css'

type Props = {
  title: string
  description: string
  onRetry?: () => void
}

export const ErrorState = ({ title, description, onRetry }: Props) => {
  return (
    <div className={s.wrap}>
      <p className={s.title}>{title}</p>
      <p className={s.description}>{description}</p>
      {onRetry && (
        <button className={s.retryButton} onClick={onRetry} type="button">
          Попробовать снова
        </button>
      )}
    </div>
  )
}
