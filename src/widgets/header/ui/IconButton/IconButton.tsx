import s from './IconButton.module.css'

type IconButtonProps = React.PropsWithChildren<{
  onClick?: () => void
  'aria-label'?: string
}>

export const IconButton = ({
  children,
  onClick,
  'aria-label': ariaLabel,
}: IconButtonProps) => {
  return (
    <button onClick={onClick} className={s.iconButton} aria-label={ariaLabel}>
      {children}
    </button>
  )
}
