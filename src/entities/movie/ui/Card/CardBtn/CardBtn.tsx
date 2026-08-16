import s from './CardBtn.module.css'

type CardBtnProps = {
  icon: React.ReactNode
  label?: string
  square?: boolean
  active?: boolean
  ariaLabel?: string
  onClick?: (e: React.MouseEvent) => void
}

export const CardBtn = ({
  icon,
  label,
  square,
  active,
  ariaLabel,
  onClick,
}: CardBtnProps) => {
  return (
    <button
      type='button'
      aria-label={ariaLabel}
      onClick={e => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className={`${s.btn} ${square ? s.btnSquare : ''} ${active ? s.btnActive : ''}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}
