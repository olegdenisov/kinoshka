import s from './IconButton.module.css'

type IconButtonProps = {
  children: React.ReactNode
  onClick?: () => void
}

export function IconButton({ children, onClick }: IconButtonProps) {
  return (
    <button onClick={onClick} className={s.iconButton}>
      {children}
    </button>
  )
}
