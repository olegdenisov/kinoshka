import { useState } from 'react'
import { useNavigate } from 'react-router'
import { MobileHeader, BottomNav, BottomSheet } from '@widgets/mobile-chrome'
import { ActiveFilterChips, useFilterState } from '@features/catalog-filter'
import { MobileCard, CATALOG, ALL_GENRES } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { FilterIcon, ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, CheckIcon } from '../../../shared/ui/Icon'

const TOTAL_RESULTS = 2846
const PER_PAGE = 16
const TOTAL_PAGES = Math.ceil(TOTAL_RESULTS / PER_PAGE)
const SORT_OPTIONS = ['Popular', 'Newest', 'Highest rated', 'Most watched', 'A to Z']

type MobilePaginationProps = {
  page: number
  totalPages: number
  onChange: (p: number) => void
}

const MobilePagination = ({ page, totalPages, onChange }: MobilePaginationProps) => {
  const pages: (number | string)[] = [1]
  const left = Math.max(2, page - 1)
  const right = Math.min(totalPages - 1, page + 1)
  if (left > 2) pages.push('…L')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPages - 1) pages.push('…R')
  if (totalPages > 1) pages.push(totalPages)

  const btnStyle = (active: boolean, disabled: boolean) => ({
    minWidth: 34, height: 34, padding: '0 8px', borderRadius: 4,
    background: active ? 'rgba(209,142,95,0.15)' : 'transparent',
    color: active ? '#D18E5F' : (disabled ? '#3A3639' : '#B8ADAB'),
    border: `1px solid ${active ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
    cursor: disabled ? 'default' as const : 'pointer' as const,
    fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
    display: 'inline-flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, flexWrap: 'wrap' as const }}>
      <button style={btnStyle(false, page === 1)} disabled={page === 1} onClick={() => onChange(page - 1)}>
        <ChevronLeftIcon size={10} />
      </button>
      {pages.map((p, i) =>
        typeof p === 'string'
          ? <span key={p + i} style={{ ...btnStyle(false, true), border: 'none', color: '#5A5059' }}>…</span>
          : <button key={p} style={btnStyle(p === page, false)} onClick={() => onChange(p)}>{p}</button>
      )}
      <button style={btnStyle(false, page === totalPages)} disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        <ChevronRightIcon size={10} />
      </button>
    </div>
  )
}

export const SearchMobile = () => {
  const navigate = useNavigate()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const { filters, setFilters, sort, setSort, toggleGenre, resetFilters, activeChips } = useFilterState()
  const [page, setPage] = useState(1)

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(TOTAL_PAGES, p)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openMovie = (movie: Movie) => navigate(`/movie/${movie.id}`)

  return (
    <div style={{ background: '#0F0D11', color: '#F2F0EF', minHeight: '100vh', paddingBottom: 80 }}>
      <MobileHeader />

      <div className="hide-scrollbar" style={{
        position: 'sticky', top: 52, zIndex: 30,
        background: 'rgba(15,13,17,0.88)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(184,173,171,0.08)',
        padding: '10px 16px', display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto',
      }}>
        <button
          onClick={() => setFiltersOpen(true)}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px',
            background: activeChips.length ? 'rgba(209,142,95,0.15)' : 'rgba(24,22,27,0.6)',
            border: `1px solid ${activeChips.length ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.12)'}`,
            color: activeChips.length ? '#D18E5F' : '#F2F0EF',
            borderRadius: 999, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 500,
          }}
        >
          <FilterIcon />
          Filters
          {activeChips.length > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 16, height: 16, padding: '0 5px', background: '#D18E5F', color: '#0F0D11', borderRadius: 999, fontSize: 10, fontWeight: 600 }}>
              {activeChips.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setSortOpen(true)}
          style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 32, padding: '0 12px',
            background: 'rgba(24,22,27,0.6)', border: '1px solid rgba(184,173,171,0.12)',
            color: '#F2F0EF', borderRadius: 999, cursor: 'pointer',
            fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 500,
          }}
        >
          <span style={{ color: '#92887F', fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sort</span>
          {sort}
          <ChevronDownIcon />
        </button>

        <ActiveFilterChips chips={activeChips} compact />
      </div>

      <div style={{ padding: '20px 20px 12px' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>2,846 results</div>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em' }}>Drama films, 2020+</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, padding: '0 16px' }}>
        {CATALOG.map((m) => <MobileCard key={m.id} movie={m} onOpen={openMovie} />)}
      </div>

      <div style={{ textAlign: 'center', marginTop: 24, padding: '0 16px' }}>
        <MobilePagination page={page} totalPages={TOTAL_PAGES} onChange={goToPage} />
        <div style={{ marginTop: 14, fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5A5059', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, TOTAL_RESULTS)} of {TOTAL_RESULTS.toLocaleString()}
        </div>
      </div>

      <BottomNav active="search" />

      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[{ key: 'movie', label: 'Movies' }, { key: 'series', label: 'Series' }, { key: 'anime', label: 'Anime' }].map((t) => (
                <button key={t.key} onClick={() => setFilters({ ...filters, type: t.key })} style={{
                  height: 40, borderRadius: 6,
                  background: filters.type === t.key ? 'rgba(209,142,95,0.15)' : 'rgba(184,173,171,0.04)',
                  color: filters.type === t.key ? '#D18E5F' : '#F2F0EF',
                  border: `1px solid ${filters.type === t.key ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
                  cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13.5, fontWeight: 500,
                }}>{t.label}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Genre</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {ALL_GENRES.map((g) => (
                <button key={g} onClick={() => toggleGenre(g)} style={{
                  height: 34, padding: '0 14px',
                  background: filters.genres.includes(g) ? 'rgba(209,142,95,0.15)' : 'rgba(184,173,171,0.04)',
                  color: filters.genres.includes(g) ? '#D18E5F' : '#B8ADAB',
                  border: `1px solid ${filters.genres.includes(g) ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
                  borderRadius: 999, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 12.5, fontWeight: 500,
                }}>{g}</button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Year</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#F2F0EF', letterSpacing: '0.04em', marginBottom: 10 }}>
              <span>{filters.yearFrom ?? '1970'}</span>
              <span>{filters.yearTo ?? '2025'}</span>
            </div>
            <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(184,173,171,0.1)' }}>
              <div style={{ position: 'absolute', left: '60%', right: '5%', top: 0, bottom: 0, background: '#D18E5F', borderRadius: 3 }} />
              <div style={{ position: 'absolute', left: '60%', top: -6, width: 18, height: 18, borderRadius: 999, background: '#F2F0EF', border: '2px solid #D18E5F', transform: 'translateX(-50%)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
              <div style={{ position: 'absolute', left: '95%', top: -6, width: 18, height: 18, borderRadius: 999, background: '#F2F0EF', border: '2px solid #D18E5F', transform: 'translateX(-50%)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }} />
            </div>
          </div>

          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Minimum rating</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[5, 6, 7, 8, 9].map((r) => (
                <button key={r} onClick={() => setFilters({ ...filters, rating: filters.rating === r ? null : r })} style={{
                  flex: 1, height: 40, borderRadius: 6,
                  background: filters.rating === r ? 'rgba(209,142,95,0.15)' : 'rgba(184,173,171,0.04)',
                  color: filters.rating === r ? '#D18E5F' : '#B8ADAB',
                  border: `1px solid ${filters.rating === r ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
                  cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500,
                }}>{r}+</button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ height: 80 }} />
        <div style={{ position: 'sticky', bottom: -20, left: -20, right: -20, margin: '0 -20px -20px', padding: '14px 20px 20px', background: 'linear-gradient(180deg, transparent, #18161B 40%)', display: 'flex', gap: 10 }}>
          <button onClick={resetFilters} style={{ flex: 1, height: 48, borderRadius: 8, background: 'transparent', border: '1px solid rgba(184,173,171,0.2)', color: '#B8ADAB', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500 }}>Reset</button>
          <button onClick={() => setFiltersOpen(false)} style={{ flex: 2, height: 48, borderRadius: 8, background: '#D18E5F', color: '#0F0D11', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 600 }}>Show 2,846 results</button>
        </div>
      </BottomSheet>

      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by" heightVh={50}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {SORT_OPTIONS.map((o) => (
            <button key={o} onClick={() => { setSort(o); setSortOpen(false) }} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 4px', background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: '1px solid rgba(184,173,171,0.06)', textAlign: 'left',
              fontFamily: 'var(--font-body)', fontSize: 15, color: sort === o ? '#D18E5F' : '#F2F0EF',
            }}>
              {o}
              {sort === o && <CheckIcon />}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
