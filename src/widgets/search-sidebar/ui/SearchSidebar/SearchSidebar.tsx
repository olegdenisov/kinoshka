import type { FilterState } from '@features/catalog-filter'
import { FilterGroup, FilterPanel } from '@features/catalog-filter'

import s from './SearchSidebar.module.css'

type SearchSidebarProps = {
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  onReset: () => void
  /** Variant A: активный текстовый поиск (?q) не сочетается с фильтрами каталога — сайдбар задизейблен. */
  disabled?: boolean
}

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
  onReset,
  disabled,
}: SearchSidebarProps) => {
  return (
    <aside className={`${s.sidebar} ${disabled ? s.sidebarDisabled : ''}`}>
      <FilterGroup title='Type' defaultOpen>
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

      <FilterPanel
        filters={filters}
        onFiltersChange={onFiltersChange}
        disabled={disabled}
      />

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
