import { EMPTY_FILTERS, filtersToSearchParams } from '@features/catalog-filter'
import type { FilterState } from '@features/catalog-filter'
import { useDebouncedValue } from '@shared/lib'
import { SearchIcon, BellIcon, CloseIcon } from '@shared/ui'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { IconButton } from '../IconButton'
import { NavPill } from '../NavPill'

import s from './Header.module.css'

const QUERY_DEBOUNCE_MS = 250
export const QUERY_MIN_LENGTH = 2

type HeaderProps = {
  variant?: 'default' | 'search'
  activeNav?: string
}

/** Строим /search-URL через тот же контракт, что HeroSection (@features/catalog-filter), а не
 * хардкодим ?type= вручную — так рефакторинг кодирования фильтра затронет и nav pills. */
const searchPathForType = (type: FilterState['type']) =>
  `/search?${filtersToSearchParams({ ...EMPTY_FILTERS, type })}`

const navItems = [
  { key: 'home', label: 'Home', path: '/' },
  { key: 'movie', label: 'Movies', path: searchPathForType('movie') },
  { key: 'series', label: 'Series', path: searchPathForType('series') },
  { key: 'anime', label: 'Anime', path: searchPathForType('anime') },
]

export const Header = ({ variant = 'default', activeNav }: HeaderProps) => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState(() => searchParams.get('q') ?? '')
  const debouncedDraft = useDebouncedValue(draft, QUERY_DEBOUNCE_MS)
  const urlQuery = searchParams.get('q') ?? ''
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
  // Отслеживает последнее значение ?q, которое сам компонент записал в URL (или увидел на
  // старте). Нужен, чтобы отличить "мы сами только что записали ?q" (после debounce/×) от
  // "URL поменялся снаружи" (back/forward в пределах /search — без ремаунта компонента).
  const lastSyncedQueryRef = useRef(urlQuery)

  // Внешние изменения ?q (browser back/forward, deep-link смена без ремаунта) должны
  // перечитаться в draft — иначе инпут продолжает показывать устаревший текст.
  // Срабатывает только когда URL разошёлся с тем, что записали мы сами (ref), поэтому
  // не гоняется наперегонки с эффектом записи ниже и не портит debounce-гейт.
  useEffect(() => {
    if (urlQuery === lastSyncedQueryRef.current) {
      return
    }
    lastSyncedQueryRef.current = urlQuery
    setDraft(urlQuery)
  }, [urlQuery])

  useEffect(() => {
    // Пишем в URL, только когда дебаунс "устоялся" (debouncedDraft === draft) — нет
    // необновлённого хвоста от предыдущей раскладки ввода. Это же защищает немедленный
    // сброс из clearQuery: пока внутренний таймер debouncedDraft ещё не догнал '',
    // эффект просто ничего не пишет — не перетирает URL, который уже очищен вручную.
    if (debouncedDraft !== draft) {
      return
    }

    const trimmed = debouncedDraft.trim()

    setSearchParams(
      prev => {
        const currentQ = prev.get('q') ?? ''

        if (trimmed.length >= QUERY_MIN_LENGTH) {
          if (currentQ === trimmed) {
            return prev
          }
          const params = new URLSearchParams(prev)
          params.set('q', trimmed)
          return params
        }

        if (currentQ) {
          const params = new URLSearchParams(prev)
          params.delete('q')
          return params
        }

        return prev
      },
      { replace: true },
    )

    // Ref обновляем и когда write ничего не поменял (currentQ уже совпадает с trimmed) —
    // синхронизация с тем, что реально окажется в URL после этого эффекта, не даёт
    // resync-эффекту выше принять наш собственный write за внешнее изменение.
    lastSyncedQueryRef.current =
      trimmed.length >= QUERY_MIN_LENGTH ? trimmed : ''
  }, [debouncedDraft, draft, setSearchParams])

  const clearQuery = () => {
    setDraft('')
    lastSyncedQueryRef.current = ''
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        params.delete('q')
        return params
      },
      { replace: true },
    )
  }

  return (
    <header className={s.header}>
      <div className={s.inner}>
        <Link to='/' className={s.logo}>
          <span className={s.logoMain}>kino</span>
          <span className={s.logoDot}>·</span>
          <span className={s.logoMain}>shka</span>
        </Link>

        {variant === 'search' ? (
          <div className={s.searchVariantCenter}>
            <div className={s.searchBox} role='search'>
              <SearchIcon />
              <input
                ref={searchInputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                placeholder='Search movies, series, anime…'
                aria-label='Search movies, series, anime'
                className={s.searchInput}
              />
              {draft ? (
                <IconButton onClick={clearQuery} aria-label='Clear search'>
                  <CloseIcon />
                </IconButton>
              ) : (
                <span className={s.searchHint}>⌘K</span>
              )}
            </div>
            <nav className={s.searchVariantNav}>
              {navItems.slice(1).map(n => (
                <NavPill
                  key={n.key}
                  label={n.label}
                  active={activeNav === n.key}
                  onClick={() => navigate(n.path)}
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
                onClick={() => navigate(n.path)}
              />
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
