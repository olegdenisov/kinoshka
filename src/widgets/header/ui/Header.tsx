import { useState } from 'react'
import { useNavigate } from 'react-router'
import { SearchIcon, BellIcon } from '../../../shared/ui/Icon'

type HeaderProps = {
  variant?: 'default' | 'search'
  activeNav?: string
}

function NavPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 34, padding: '0 14px',
        background: active ? 'rgba(209,142,95,0.12)' : (h ? 'rgba(184,173,171,0.06)' : 'transparent'),
        color: active ? '#D18E5F' : (h ? '#F2F0EF' : '#B8ADAB'),
        border: 'none', borderRadius: 4, cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
        letterSpacing: '-0.005em', transition: 'all 160ms',
      }}
    >{label}</button>
  )
}

function IconButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        width: 36, height: 36, borderRadius: 4, cursor: 'pointer',
        background: h ? 'rgba(184,173,171,0.08)' : 'transparent',
        border: 'none', color: h ? '#F2F0EF' : '#B8ADAB',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 160ms',
      }}
    >{children}</button>
  )
}

export function Header({ variant = 'default', activeNav }: HeaderProps) {
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const navItems = [
    { key: 'home', label: 'Home', path: '/' },
    { key: 'movies', label: 'Movies', path: '/search' },
    { key: 'series', label: 'Series', path: '/search' },
    { key: 'anime', label: 'Anime', path: '/search' },
  ]

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(15,13,17,0.72)',
      backdropFilter: 'blur(14px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
      borderBottom: '1px solid rgba(184,173,171,0.08)',
    }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto', padding: '16px 40px',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 32,
      }}>
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 1, cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          <span style={{ color: '#F2F0EF' }}>kino</span>
          <span style={{ color: '#D18E5F' }}>·</span>
          <span style={{ color: '#F2F0EF' }}>shka</span>
        </div>

        {variant === 'search' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              flex: 1, maxWidth: 640,
              display: 'flex', alignItems: 'center', gap: 10,
              height: 40, padding: '0 14px',
              background: '#18161B',
              border: '1px solid rgba(184,173,171,0.15)',
              borderRadius: 6,
            }}>
              <SearchIcon />
              <input
                value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search movies, series, anime…"
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#F2F0EF', fontFamily: 'var(--font-body)', fontSize: 13.5,
                  letterSpacing: '-0.005em',
                }}
              />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 10,
                color: '#5A5059', letterSpacing: '0.1em',
              }}>⌘K</span>
            </div>
            <nav style={{ display: 'flex', gap: 4 }}>
              {navItems.slice(1).map((n) => (
                <NavPill key={n.key} label={n.label} active={activeNav === n.key} onClick={() => navigate('/search')} />
              ))}
            </nav>
          </div>
        ) : (
          <nav style={{ display: 'flex', gap: 2, justifySelf: 'center' }}>
            {navItems.map((n) => (
              <NavPill
                key={n.key} label={n.label}
                active={activeNav === n.key}
                onClick={() => navigate(n.path)}
              />
            ))}
          </nav>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {variant !== 'search' && (
            <IconButton onClick={() => navigate('/search')}>
              <SearchIcon />
            </IconButton>
          )}
          <IconButton>
            <BellIcon />
            <span style={{
              position: 'absolute', top: 8, right: 8, width: 6, height: 6, borderRadius: 999,
              background: '#D18E5F',
            }} />
          </IconButton>
          <div style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'linear-gradient(135deg, oklch(0.5 0.09 40), oklch(0.35 0.06 20))',
            border: '1px solid rgba(184,173,171,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: '#F2F0EF',
            cursor: 'pointer',
          }}>
            AV
          </div>
        </div>
      </div>
    </header>
  )
}
