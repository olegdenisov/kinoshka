import { HomeIcon, SearchIcon, ListsIcon, ProfileIcon } from '@shared/ui'
import { useNavigate } from 'react-router'

import s from './BottomNav.module.css'

type NavKey = 'home' | 'search' | 'lists' | 'profile'

type BottomNavProps = {
  active: NavKey
}

export const BottomNav = ({ active }: BottomNavProps) => {
  const navigate = useNavigate()

  const items: {
    key: NavKey
    label: string
    icon: typeof HomeIcon
    path: string | null
  }[] = [
    { key: 'home', label: 'Home', icon: HomeIcon, path: '/' },
    { key: 'search', label: 'Catalog', icon: SearchIcon, path: '/search' },
    { key: 'lists', label: 'Lists', icon: ListsIcon, path: null },
    { key: 'profile', label: 'Profile', icon: ProfileIcon, path: null },
  ]

  return (
    <nav className={s.nav}>
      <div className={s.grid}>
        {items.map(it => {
          const Icon = it.icon
          const isActive = active === it.key
          return (
            <button
              type='button'
              key={it.key}
              onClick={() => it.path && navigate(it.path)}
              className={`${s.navItem} ${isActive ? s.navItemActive : ''} ${!it.path ? s.navItemDisabled : ''}`}
            >
              <Icon size={20} filled={isActive} />
              <span
                className={`${s.navLabel} ${isActive ? s.navLabelActive : ''}`}
              >
                {it.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
