import type { FilterState } from '@features/catalog-filter'
import { GenreSelector } from '@features/catalog-filter'

import s from './SearchSidebar.module.css'

type SearchSidebarProps = {
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  onToggleGenre: (g: string) => void
  onReset: () => void
  /** Variant A: активный текстовый поиск (?q) не сочетается с фильтрами каталога — сайдбар задизейблен. */
  disabled?: boolean
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
  disabled?: boolean
  onClick: () => void
}

const RadioRow = ({
  label,
  count,
  active,
  disabled,
  onClick,
}: RadioRowProps) => (
  <button
    type='button'
    onClick={onClick}
    disabled={disabled}
    className={`${s.radioRow} ${active ? s.radioRowActive : ''}`}
  >
    <span className={s.radioRowLeft}>
      <span className={`${s.radioCircle} ${active ? s.radioCircleActive : ''}`}>
        {active && <span className={s.radioDot} />}
      </span>
      <span className={`${s.radioLabel} ${active ? s.radioLabelActive : ''}`}>
        {label}
      </span>
    </span>
    <span className={s.radioCount}>{count}</span>
  </button>
)

export const SearchSidebar = ({
  filters,
  onFiltersChange,
  onToggleGenre,
  onReset,
  disabled,
}: SearchSidebarProps) => {
  return (
    <aside className={`${s.sidebar} ${disabled ? s.sidebarDisabled : ''}`}>
      <FilterGroup title='Type'>
        <div className={s.radioList}>
          {[
            { key: 'movie', label: 'Movies', count: '42,180' },
            { key: 'series', label: 'Series', count: '8,640' },
            { key: 'anime', label: 'Anime', count: '4,920' },
          ].map(t => (
            <RadioRow
              key={t.key}
              label={t.label}
              count={t.count}
              active={filters.type === t.key}
              disabled={disabled}
              onClick={() => onFiltersChange({ ...filters, type: t.key })}
            />
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title='Genre'>
        <GenreSelector
          selected={filters.genres}
          onToggle={onToggleGenre}
          disabled={disabled}
        />
      </FilterGroup>

      <FilterGroup title='Year'>
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

      <FilterGroup title='Rating'>
        <div className={s.ratingList}>
          {[5, 6, 7, 8, 9].map(r => (
            <button
              type='button'
              key={r}
              disabled={disabled}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  rating: filters.rating === r ? null : r,
                })
              }
              className={`${s.ratingBtn} ${filters.rating === r ? s.ratingBtnActive : ''}`}
            >
              {r}+
            </button>
          ))}
        </div>
      </FilterGroup>

      <div className={s.resetSection}>
        <button
          type='button'
          onClick={onReset}
          disabled={disabled}
          className={s.resetBtn}
        >
          Reset filters
        </button>
      </div>
    </aside>
  )
}
