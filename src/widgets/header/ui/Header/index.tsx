import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SearchIcon, BellIcon } from '@shared/ui'
import { NavPill } from '../NavPill'
import { IconButton } from '../IconButton'
import s from './Header.module.css'

type HeaderProps = {
  variant?: 'default' | 'search'
  activeNav?: string
}

const navItems = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'movies', label: 'Movies', path: '/search' },
  { key: 'series', label: 'Series', path: '/search' },
  { key: 'anime', label: 'Anime', path: '/search' },
]

export const Header = ({ variant = 'default', activeNav }: HeaderProps) => {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  return (
    <header className={s.header}>
      <div className={s.inner}>
        <div className={s.logo} onClick={() => navigate('/')}>
          <span className={s.logoMain}>kino</span>
          <span className={s.logoDot}>·</span>
          <span className={s.logoMain}>shka</span>
        </div>

        {variant === 'search' ? (
          <div className={s.searchVariantCenter}>
            <div className={s.searchBox}>
              <SearchIcon />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search movies, series, anime…"
                className={s.searchInput}
              />
              <span className={s.searchHint}>⌘K</span>
            </div>
            <nav className={s.searchVariantNav}>
              {navItems.slice(1).map((n) => (
                <NavPill key={n.key} label={n.label} active={activeNav === n.key} onClick={() => navigate('/search')} />
              ))}
            </nav>
          </div>
        ) : (
          <nav className={s.nav}>
            {navItems.map((n) => (
              <NavPill key={n.key} label={n.label} active={activeNav === n.key} onClick={() => navigate(n.path)} />
            ))}
          </nav>
        )}

        <div className={s.actions}>
          {variant !== 'search' && (
            <IconButton onClick={() => navigate('/search')}>
              <SearchIcon />
            </IconButton>
          )}
          <IconButton>
            <BellIcon />
            <span className={s.notificationDot} />
          </IconButton>
          <div className={s.avatar}>AV</div>
        </div>
      </div>
    </header>
  )
}
