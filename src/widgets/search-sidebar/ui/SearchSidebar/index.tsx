import type { FilterState } from '@features/catalog-filter'
import s from './SearchSidebar.module.css'

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
    <div className={s.filterGroup}>
      <div className={s.filterGroupTitle}>{title}</div>
      {children}
    </div>
  )
}

function RadioRow({ label, count, active, onClick }: { label: string; count: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${s.radioRow} ${active ? s.radioRowActive : ''}`}
    >
      <span className={s.radioRowLeft}>
        <span className={`${s.radioCircle} ${active ? s.radioCircleActive : ''}`}>
          {active && <span className={s.radioDot} />}
        </span>
        <span className={`${s.radioLabel} ${active ? s.radioLabelActive : ''}`}>{label}</span>
      </span>
      <span className={s.radioCount}>{count}</span>
    </button>
  )
}

function GenreChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`${s.genreChip} ${active ? s.genreChipActive : ''}`}
    >
      {label}
    </button>
  )
}

export function SearchSidebar({ filters, onFiltersChange, onToggleGenre, onReset }: SearchSidebarProps) {
  return (
    <aside className={s.sidebar}>
      <FilterGroup title="Type">
        <div className={s.radioList}>
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
        <div className={s.genreList}>
          {ALL_GENRES.map((g) => (
            <GenreChip key={g} label={g} active={filters.genres.includes(g)} onClick={() => onToggleGenre(g)} />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Year">
        <div>
          <div className={s.yearDisplay}>
            <span>{filters.yearFrom ?? '1970'}</span>
            <span>{filters.yearTo ?? '2025'}</span>
          </div>
          <div className={s.rangeTrack}>
            <div className={s.rangeFill} />
            <div className={`${s.rangeThumb} ${s.rangeThumbLeft}`} />
            <div className={`${s.rangeThumb} ${s.rangeThumbRight}`} />
          </div>
        </div>
      </FilterGroup>

      <FilterGroup title="Rating">
        <div className={s.ratingList}>
          {[5, 6, 7, 8, 9].map((r) => (
            <button
              key={r}
              onClick={() => onFiltersChange({ ...filters, rating: filters.rating === r ? null : r })}
              className={`${s.ratingBtn} ${filters.rating === r ? s.ratingBtnActive : ''}`}
            >
              {r}+
            </button>
          ))}
        </div>
      </FilterGroup>

      <div className={s.resetSection}>
        <button onClick={onReset} className={s.resetBtn}>Reset filters</button>
      </div>
    </aside>
  )
}
