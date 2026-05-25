import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Header } from '../../../widgets/header/ui/Header'
import { SearchSidebar } from '../../../widgets/search-sidebar/ui/SearchSidebar'
import { ActiveFilterChips } from '../../../features/catalog-filter/ui/ActiveFilterChips'
import { useFilterState } from '../../../features/catalog-filter/model/useFilterState'
import { Card } from '../../../entities/movie/ui/Card'
import { CATALOG } from '../../../entities/movie/model/catalog'
import type { Movie } from '../../../entities/movie/model/types'
import { ChevronLeftIcon, ChevronRightIcon, ChevronDownIcon } from '../../../shared/ui/Icon'

const TOTAL_RESULTS = 2846
const PER_PAGE = 16
const TOTAL_PAGES = Math.ceil(TOTAL_RESULTS / PER_PAGE)

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const pages: (number | string)[] = []
  pages.push(1)
  const left = Math.max(2, page - 1)
  const right = Math.min(totalPages - 1, page + 1)
  if (left > 2) pages.push('…L')
  for (let i = left; i <= right; i++) pages.push(i)
  if (right < totalPages - 1) pages.push('…R')
  if (totalPages > 1) pages.push(totalPages)

  const [hoveredPage, setHoveredPage] = useState<number | string | null>(null)

  const btnStyle = (active: boolean, disabled: boolean, hovered: boolean) => ({
    minWidth: 36, height: 36, padding: '0 10px', borderRadius: 4,
    background: active ? 'rgba(209,142,95,0.15)' : (hovered && !disabled ? 'rgba(184,173,171,0.08)' : 'transparent'),
    color: active ? '#D18E5F' : (disabled ? '#3A3639' : (hovered ? '#F2F0EF' : '#B8ADAB')),
    border: `1px solid ${active ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.1)'}`,
    cursor: disabled ? 'default' as const : 'pointer' as const,
    fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500, letterSpacing: '0.02em',
    transition: 'all 140ms',
    display: 'inline-flex' as const, alignItems: 'center' as const, justifyContent: 'center' as const,
  })

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 48 }}>
      <button
        disabled={page === 1} onClick={() => onChange(page - 1)}
        onMouseEnter={() => setHoveredPage('prev')} onMouseLeave={() => setHoveredPage(null)}
        style={btnStyle(false, page === 1, hoveredPage === 'prev')}
      >
        <ChevronLeftIcon size={11} />
      </button>
      {pages.map((p, i) =>
        typeof p === 'string' ? (
          <span key={p + i} style={{ width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#5A5059' }}>…</span>
        ) : (
          <button
            key={p} onClick={() => onChange(p)}
            onMouseEnter={() => setHoveredPage(p)} onMouseLeave={() => setHoveredPage(null)}
            style={btnStyle(p === page, false, hoveredPage === p)}
          >{p}</button>
        )
      )}
      <button
        disabled={page === totalPages} onClick={() => onChange(page + 1)}
        onMouseEnter={() => setHoveredPage('next')} onMouseLeave={() => setHoveredPage(null)}
        style={btnStyle(false, page === totalPages, hoveredPage === 'next')}
      >
        <ChevronRightIcon size={11} />
      </button>
    </div>
  )
}

function SortSelect({ value }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8, height: 32, padding: '0 12px',
      background: '#18161B', border: '1px solid rgba(184,173,171,0.12)', borderRadius: 4,
      fontFamily: 'var(--font-body)', fontSize: 13, color: '#F2F0EF', cursor: 'pointer',
    }}>
      <span style={{ color: '#92887F', fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Sort</span>
      <span>{value}</span>
      <ChevronDownIcon />
    </div>
  )
}

export function SearchDesktop() {
  const navigate = useNavigate()
  const { filters, setFilters, sort, setSort, toggleGenre, resetFilters, activeChips } = useFilterState()
  const [page, setPage] = useState(1)

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(TOTAL_PAGES, p)))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openMovie = (movie: Movie) => navigate(`/movie/${movie.id}`)

  return (
    <div style={{ background: '#0F0D11', color: '#F2F0EF', minHeight: '100vh' }}>
      <Header variant="search" activeNav="search" />

      <div style={{ maxWidth: 1440, margin: '0 auto', padding: '32px 40px 80px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 40 }}>
        <SearchSidebar filters={filters} onFiltersChange={setFilters} onToggleGenre={toggleGenre} onReset={resetFilters} />

        <main>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
              Catalog · /search
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 500, letterSpacing: '-0.02em' }}>
              Drama films, 2020 onwards
              <span style={{ marginLeft: 14, fontFamily: 'var(--font-mono)', fontSize: 14, color: '#92887F', letterSpacing: '0.06em', fontWeight: 400 }}>
                2,846 results
              </span>
            </h1>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
            <ActiveFilterChips chips={activeChips} onClearAll={resetFilters} />
            <SortSelect value={sort} onChange={setSort} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24 }}>
            {CATALOG.map((m) => (
              <Card key={m.id} movie={m} variant="grid" onOpen={openMovie} />
            ))}
          </div>

          <Pagination page={page} totalPages={TOTAL_PAGES} onChange={goToPage} />

          <div style={{ textAlign: 'center', marginTop: 16, fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#5A5059', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, TOTAL_RESULTS)} of {TOTAL_RESULTS.toLocaleString()}
          </div>
        </main>
      </div>
    </div>
  )
}
