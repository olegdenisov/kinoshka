import type { FilterState } from '../../../features/catalog-filter/model/useFilterState'

type SearchSidebarProps = {
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  onToggleGenre: (g: string) => void
  onReset: () => void
}

const ALL_GENRES = [
  'Action', 'Drama', 'Sci-Fi', 'Thriller', 'Romance', 'Horror',
  'Mystery', 'Documentary', 'Historical', 'Adventure', 'Family', 'Slice of Life', 'Fantasy',
]

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '16px', borderBottom: '1px solid rgba(184,173,171,0.08)' }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10.5,
        color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase',
        marginBottom: 12,
      }}>{title}</div>
      {children}
    </div>
  )
}

function RadioRow({ label, count, active, onClick }: { label: string; count: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, padding: '8px 10px', borderRadius: 4, width: '100%',
        background: active ? 'rgba(209,142,95,0.12)' : 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
        transition: 'background 160ms',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(184,173,171,0.05)' }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 14, height: 14, borderRadius: 999, flexShrink: 0,
          border: `1.5px solid ${active ? '#D18E5F' : 'rgba(184,173,171,0.25)'}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {active && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#D18E5F' }} />}
        </span>
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 13.5, color: active ? '#F2F0EF' : '#B8ADAB' }}>{label}</span>
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#5A5059', letterSpacing: '0.04em' }}>{count}</span>
    </button>
  )
}

function GenreChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        height: 28, padding: '0 10px',
        background: active ? 'rgba(209,142,95,0.15)' : 'rgba(184,173,171,0.04)',
        color: active ? '#D18E5F' : '#B8ADAB',
        border: `1px solid ${active ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.08)'}`,
        borderRadius: 4, cursor: 'pointer',
        fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
        transition: 'all 140ms',
      }}
    >{label}</button>
  )
}

export function SearchSidebar({ filters, onFiltersChange, onToggleGenre, onReset }: SearchSidebarProps) {
  return (
    <aside style={{
      position: 'sticky', top: 88, alignSelf: 'start',
      maxHeight: 'calc(100vh - 108px)', overflowY: 'auto',
      background: '#18161B',
      border: '1px solid rgba(184,173,171,0.08)',
      borderRadius: 8, padding: 4,
    }}>
      <FilterGroup title="Type">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { key: 'movie', label: 'Movies', count: '42,180' },
            { key: 'series', label: 'Series', count: '8,640' },
            { key: 'anime', label: 'Anime', count: '4,920' },
          ].map((t) => (
            <RadioRow
              key={t.key} label={t.label} count={t.count}
              active={filters.type === t.key}
              onClick={() => onFiltersChange({ ...filters, type: t.key })}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Genre">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ALL_GENRES.map((g) => (
            <GenreChip key={g} label={g} active={filters.genres.includes(g)} onClick={() => onToggleGenre(g)} />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Year">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: 'var(--font-mono)', fontSize: 11, color: '#B8ADAB', letterSpacing: '0.04em',
          }}>
            <span>{filters.yearFrom ?? '1970'}</span>
            <span>{filters.yearTo ?? '2025'}</span>
          </div>
          <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'rgba(184,173,171,0.1)' }}>
            <div style={{ position: 'absolute', left: '60%', right: '5%', top: 0, bottom: 0, background: '#D18E5F', borderRadius: 2 }} />
            <div style={{ position: 'absolute', left: '60%', top: -4, width: 12, height: 12, borderRadius: 999, background: '#F2F0EF', border: '2px solid #D18E5F', transform: 'translateX(-50%)' }} />
            <div style={{ position: 'absolute', left: '95%', top: -4, width: 12, height: 12, borderRadius: 999, background: '#F2F0EF', border: '2px solid #D18E5F', transform: 'translateX(-50%)' }} />
          </div>
        </div>
      </FilterGroup>

      <FilterGroup title="Rating">
        <div style={{ display: 'flex', gap: 4 }}>
          {[5, 6, 7, 8, 9].map((r) => (
            <button
              key={r}
              onClick={() => onFiltersChange({ ...filters, rating: filters.rating === r ? null : r })}
              style={{
                flex: 1, height: 32, borderRadius: 4,
                background: filters.rating === r ? 'rgba(209,142,95,0.15)' : 'rgba(184,173,171,0.04)',
                color: filters.rating === r ? '#D18E5F' : '#B8ADAB',
                border: `1px solid ${filters.rating === r ? 'rgba(209,142,95,0.35)' : 'rgba(184,173,171,0.08)'}`,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 11.5, fontWeight: 500, letterSpacing: '0.02em',
              }}
            >{r}+</button>
          ))}
        </div>
      </FilterGroup>

      <div style={{ padding: 16 }}>
        <button
          onClick={onReset}
          style={{
            width: '100%', height: 36, background: 'transparent',
            border: '1px solid rgba(184,173,171,0.15)', color: '#B8ADAB',
            borderRadius: 4, cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase',
          }}
        >Reset filters</button>
      </div>
    </aside>
  )
}
