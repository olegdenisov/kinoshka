import type { FilterState } from '@features/catalog-filter'
import s from './SearchSidebar.module.css'
import { useGetGenresQuery } from '../../api'
import { isMovieType } from '@entities/movie'

type SearchSidebarProps = {
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  onToggleGenre: (g: string) => void
  onReset: () => void
}

type FilterGroupProps = React.PropsWithChildren<{
  title: string
}>

const FilterGroup = ({ title, children }: FilterGroupProps) => (
  <div className={s.filterGroup}>
    <div className={s.filterGroupTitle}>{title}</div>
    {children}
  </div>
)

type RadioRowProps = {
  label: string
  count: string
  active: boolean
  onClick: () => void
}

const RadioRow = ({ label, count, active, onClick }: RadioRowProps) => (
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

type GenreChipProps = {
  label: string
  active: boolean
  onClick: () => void
}

const GenreChip = ({ label, active, onClick }: GenreChipProps) => (
  <button
    onClick={onClick}
    className={`${s.genreChip} ${active ? s.genreChipActive : ''}`}
  >
    {label}
  </button>
)

export const SearchSidebar = ({ filters, onFiltersChange, onToggleGenre, onReset }: SearchSidebarProps) => {
  const {data: genres = []} = useGetGenresQuery('genres.name')
  const {data: types = []} = useGetGenresQuery('type')

  return (
    <aside className={s.sidebar}>
      <FilterGroup title="Type">
        <div className={s.radioList}>
          {types.map((t) => {
            const name = t.name ?? ''
            const slug = t.slug ?? name
            return isMovieType(name) ? <RadioRow
              key={slug} label={name} count={''}
              active={filters.type === name}
              onClick={() => onFiltersChange({ ...filters, type: name })}
            /> : null
          })}
        </div>
      </FilterGroup>

      <FilterGroup title="Genre">
        <div className={s.genreList}>
          {genres.map((g) => {
            const name = g.name ?? ''
            const slug = g.slug ?? name
            return name
              ? <GenreChip
                  key={slug}
                  label={name}
                  active={filters.genres.includes(name)}
                  onClick={() => onToggleGenre(name)}
                />
              : null
          })}
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
