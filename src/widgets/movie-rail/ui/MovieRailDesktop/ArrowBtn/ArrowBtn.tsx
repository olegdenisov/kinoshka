import s from './ArrowBtn.module.css'

type ArrowBtnProps = {
  dir: 'left' | 'right'
  onClick: () => void
}

export const ArrowBtn = ({ dir, onClick }: ArrowBtnProps) => {
  return (
    <button onClick={onClick} className={s.arrowBtn}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path
          d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
