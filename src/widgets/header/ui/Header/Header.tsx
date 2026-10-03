import {
  commitSearchDraft,
  EMPTY_FILTERS,
  filtersToSearchParams,
  searchDraft,
  submitSearchQuery,
} from '@features/catalog-filter'
import type { FilterState } from '@features/catalog-filter'
import { ProfileAvatar } from '@features/profile'
import { ThemeToggle } from '@features/theme'
import { urlAtom, wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { paths } from '@shared/config'
import { SearchIcon, BellIcon, CloseIcon, IconButton } from '@shared/ui'
import { useEffect, useRef } from 'react'

import { NavPill } from '../NavPill'

import s from './Header.module.css'

type HeaderProps = {
  variant?: 'default' | 'search'
  activeNav?: string
}

/** Строим /search-URL через тот же контракт, что HeroSection (@features/catalog-filter), а не
 * хардкодим ?type= вручную — так рефакторинг кодирования фильтра затронет и nav pills. */
const searchPathForType = (type: FilterState['type']) =>
  paths.search(filtersToSearchParams({ ...EMPTY_FILTERS, type }))

const typeNavItems = [
  { key: 'movie', label: 'Movies', path: searchPathForType('movie') },
  { key: 'series', label: 'Series', path: searchPathForType('series') },
  { key: 'anime', label: 'Anime', path: searchPathForType('anime') },
]

const navItems = [
  { key: 'home', label: 'Home', path: paths.home() },
  ...typeNavItems,
  { key: 'favorites', label: 'Favorites', path: paths.favorites() },
  { key: 'popular', label: 'Popular', path: paths.popular() },
  { key: 'recommendations', label: 'Picks', path: paths.recommendations() },
]

// reatomComponent: черновик поиска — атом searchDraft (следует за ?q при back/forward и принимает
// ввод), запись в URL — commitSearchDraft с debounce. Обычный компонент закэшировал бы значение.
export const Header = reatomComponent(
  ({ variant = 'default', activeNav }: HeaderProps) => {
    const draft = searchDraft()
    const searchInputRef = useRef<HTMLInputElement>(null)

    // ⌘K/Ctrl+K подсказка рядом с полем поиска (см. searchHint ниже) была чисто визуальной —
    // фокусирует инпут, только когда сам поисковый блок реально смонтирован (variant='search').
    useEffect(() => {
      if (variant !== 'search') {
        return
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        // `e.code` — физическая клавиша (layout-независимая), не `e.key`: на нелатинской
        // раскладке (например, кириллице) `e.key` для той же физической K даёт другой символ.
        if ((e.metaKey || e.ctrlKey) && e.code === 'KeyK') {
          e.preventDefault()
          searchInputRef.current?.focus()
        }
      }

      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [variant])

    // Инпут есть только в variant='search', а мутации URL поиска вне /search ничего не пишут —
    // скрытый Header на других роутах ?q не трогает.
    const handleChange = (value: string) => {
      searchDraft.set(value)
      commitSearchDraft()
    }

    // × чистит URL сразу, без debounce; отложенный коммит, если он ещё спит, прочитает пустой
    // черновик и ничего не запишет.
    const clearQuery = () => {
      searchDraft.set('')
      submitSearchQuery('')
    }

    return (
      <header className={s.header}>
        <div className={s.inner}>
          <a href={paths.home()} className={s.logo}>
            <span className={s.logoMain}>kino</span>
            <span className={s.logoDot}>·</span>
            <span className={s.logoMain}>shka</span>
          </a>

          {variant === 'search' ? (
            <div className={s.searchVariantCenter}>
              <div className={s.searchBox} role='search'>
                <SearchIcon />
                <input
                  ref={searchInputRef}
                  value={draft}
                  onChange={wrap(e => handleChange(e.target.value))}
                  placeholder='Search movies, series, anime…'
                  aria-label='Search movies, series, anime'
                  className={s.searchInput}
                />
                {draft ? (
                  <IconButton
                    onClick={wrap(clearQuery)}
                    aria-label='Clear search'
                  >
                    <CloseIcon />
                  </IconButton>
                ) : (
                  <span className={s.searchHint}>⌘K</span>
                )}
              </div>
              <nav className={s.searchVariantNav}>
                {typeNavItems.map(n => (
                  <NavPill
                    key={n.key}
                    label={n.label}
                    active={activeNav === n.key}
                    onClick={wrap(() => urlAtom.go(n.path))}
                  />
                ))}
              </nav>
            </div>
          ) : (
            <nav className={s.nav}>
              {navItems.map(n => (
                <NavPill
                  key={n.key}
                  label={n.label}
                  active={activeNav === n.key}
                  onClick={wrap(() => urlAtom.go(n.path))}
                />
              ))}
            </nav>
          )}

          <div className={s.actions}>
            {variant !== 'search' && (
              <IconButton
                onClick={wrap(() => urlAtom.go(paths.search()))}
                aria-label='Open search'
              >
                <SearchIcon />
              </IconButton>
            )}
            <IconButton aria-label='Notifications'>
              <BellIcon />
              <span className={s.notificationDot} />
            </IconButton>
            <ThemeToggle />
            <ProfileAvatar />
          </div>
        </div>
      </header>
    )
  },
  'Header',
)
