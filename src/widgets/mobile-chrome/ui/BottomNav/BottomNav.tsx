import { urlAtom, wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { paths } from '@shared/config'
import {
  HomeIcon,
  SearchIcon,
  ListsIcon,
  TrendingIcon,
  StarIcon,
  ProfileIcon,
} from '@shared/ui'

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

export const BottomNav = reatomComponent(({ active }: BottomNavProps) => {
  const { pathname, search, hash } = urlAtom()

  const items: {
    key: NavKey
    label: string
    icon: typeof HomeIcon
    path: string
  }[] = [
    { key: 'home', label: 'Home', icon: HomeIcon, path: paths.home() },
    { key: 'search', label: 'Catalog', icon: SearchIcon, path: paths.search() },
    { key: 'lists', label: 'Lists', icon: ListsIcon, path: paths.favorites() },
    {
      key: 'popular',
      label: 'Popular',
      icon: TrendingIcon,
      path: paths.popular(),
    },
    {
      key: 'recommendations',
      label: 'Picks',
      icon: StarIcon,
      path: paths.recommendations(),
    },
    {
      key: 'profile',
      label: 'Profile',
      icon: ProfileIcon,
      path: paths.profile(),
    },
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
              onClick={wrap(() =>
                urlAtom.go(it.path, `${pathname}${search}${hash}` === it.path),
              )}
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
}, 'BottomNav')
