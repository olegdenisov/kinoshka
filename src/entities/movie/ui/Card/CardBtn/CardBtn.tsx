import s from './CardBtn.module.css'

type CardBtnProps = {
  icon: React.ReactNode
  label?: string
  square?: boolean
}

export const CardBtn = ({ icon, label, square }: CardBtnProps) => {
  return (
    <button
      type='button'
      onClick={e => e.stopPropagation()}
      className={`${s.btn} ${square ? s.btnSquare : ''}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}
