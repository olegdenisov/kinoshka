import { useNavigate } from 'react-router'
import { SearchIcon, ChevronLeftIcon } from '@shared/ui'
import s from './MobileHeader.module.css'

type MobileHeaderProps = {
  title?: string | null
  showSearch?: boolean
  onSearchFocus?: () => void
  onBack?: () => void
  rightAction?: React.ReactNode
}

export const MobileHeader = ({
  title,
  showSearch = true,
  onSearchFocus,
  onBack,
  rightAction,
}: MobileHeaderProps) => {
  const navigate = useNavigate()
  const handleSearchFocus = onSearchFocus ?? (() => navigate('/search'))

  return (
    <header className={s.header}>
      <div className={s.inner}>
        {onBack ? (
          <button type='button' onClick={onBack} className={s.backBtn}>
            <ChevronLeftIcon size={14} />
          </button>
        ) : (
          <div className={s.logo}>
            <span className={s.logoMain}>kino</span>
            <span className={s.logoDot}>·</span>
            <span className={s.logoMain}>shka</span>
          </div>
        )}

        {title && <div className={s.title}>{title}</div>}

        {showSearch && !title && (
          <button
            type='button'
            onClick={handleSearchFocus}
            className={s.searchTrigger}
          >
            <SearchIcon size={14} />
            <span>Search…</span>
          </button>
        )}

        {rightAction ?? <div className={s.avatar}>AV</div>}
      </div>
    </header>
  )
}
