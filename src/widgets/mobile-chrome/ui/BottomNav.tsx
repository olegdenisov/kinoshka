import { useNavigate } from 'react-router'
import { HomeIcon, SearchIcon, ListsIcon, ProfileIcon } from '../../../shared/ui/Icon'

type NavKey = 'home' | 'search' | 'lists' | 'profile'

type BottomNavProps = {
  active: NavKey
}

export function BottomNav({ active }: BottomNavProps) {
  const navigate = useNavigate()

  const items: { key: NavKey; label: string; icon: typeof HomeIcon; path: string | null }[] = [
    { key: 'home', label: 'Home', icon: HomeIcon, path: '/' },
    { key: 'search', label: 'Catalog', icon: SearchIcon, path: '/search' },
    { key: 'lists', label: 'Lists', icon: ListsIcon, path: null },
    { key: 'profile', label: 'Profile', icon: ProfileIcon, path: null },
  ]

  return (
    <nav style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 50,
      background: 'rgba(15,13,17,0.92)',
      backdropFilter: 'blur(20px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.2)',
      borderTop: '1px solid rgba(184,173,171,0.1)',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '6px 4px 8px',
      }}>
        {items.map((it) => {
          const Icon = it.icon
          const isActive = active === it.key
          return (
            <button
              key={it.key}
              onClick={() => it.path && navigate(it.path)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                background: 'transparent', border: 'none', cursor: it.path ? 'pointer' : 'default',
                padding: '8px 4px', borderRadius: 6,
                color: isActive ? '#D18E5F' : '#92887F',
                transition: 'color 140ms',
              }}
            >
              <Icon size={20} filled={isActive} />
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9.5,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                fontWeight: isActive ? 600 : 400,
              }}>{it.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
