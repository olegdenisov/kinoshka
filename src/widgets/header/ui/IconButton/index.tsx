import s from './IconButton.module.css'

type IconButtonProps = React.PropsWithChildren<{
  onClick?: () => void
}>

export const IconButton = ({ children, onClick }: IconButtonProps) => {
  return (
    <button onClick={onClick} className={s.iconButton}>
      {children}
    </button>
  )
}
