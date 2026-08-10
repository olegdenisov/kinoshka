import s from "./NavPill.module.css"

type NavPillProps = {
  label: string
  active: boolean
  onClick: () => void
}

export const NavPill = ({ label, active, onClick }: NavPillProps) => {
  return (
    <button
      onClick={onClick}
      className={`${s.navPill} ${active ? s.navPillActive : ""}`}
    >
      {label}
    </button>
  )
}
