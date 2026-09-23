import {
  HomeIcon,
  SearchIcon,
  ListsIcon,
  TrendingIcon,
  StarIcon,
  ProfileIcon,
} from '@shared/ui'
import { useLocation, useNavigate } from 'react-router'

import s from './BottomNav.module.css'

type NavKey =
  | 'home'
  | 'search'
  | 'lists'
  | 'popular'
  | 'recommendations'
  | 'profile'

type BottomNavProps = {
  active: NavKey
}

export const BottomNav = ({ active }: BottomNavProps) => {
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()

  const items: {
    key: NavKey
    label: string
    icon: typeof HomeIcon
    path: string
  }[] = [
    { key: 'home', label: 'Home', icon: HomeIcon, path: '/' },
    { key: 'search', label: 'Catalog', icon: SearchIcon, path: '/search' },
    { key: 'lists', label: 'Lists', icon: ListsIcon, path: '/favorites' },
    { key: 'popular', label: 'Popular', icon: TrendingIcon, path: '/popular' },
    {
      key: 'recommendations',
      label: 'Picks',
      icon: StarIcon,
      path: '/recommendations',
    },
    { key: 'profile', label: 'Profile', icon: ProfileIcon, path: '/profile' },
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
              // replace на уже открытой странице: иначе повторный тап по активному пункту
              // кладёт в историю дубль, и первое «Назад» визуально ничего не делает. Сравниваем
              // с pathname, а не с isActive: у /movie/:id активен пункт search, но это другая
              // страница, и переход на /search должен быть обычным push. Сравниваем весь текущий
              // URL (pathname+search+hash) с it.path, а не только pathname: все it.path — без
              // query/hash, так что на /search?q=… (BottomNav есть в SEARCH_CHROME) повторный тап
              // по «Catalog» иначе стёр бы отфильтрованный URL из истории через replace, хотя
              // страница другая — просто с тем же pathname.
              onClick={() =>
                navigate(it.path, {
                  replace: `${pathname}${search}${hash}` === it.path,
                })
              }
              className={`${s.navItem} ${isActive ? s.navItemActive : ''}`}
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
