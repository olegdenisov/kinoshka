import {
  DURATION_VALUES,
  getDurationLabel,
  getListLabel,
  getPlatformLabel,
  isDuration,
  LIST_OPTIONS,
  PLATFORM_OPTIONS,
} from '../../lib/filterOptions'
import type { FilterState } from '../../model/useFilterState'
import { ChipSelect } from '../ChipSelect'
import { CountrySelector } from '../CountrySelector'
import { FilterGroup } from '../FilterGroup'
import { GenreSelector } from '../GenreSelector'
import { YearRangeSlider } from '../YearRangeSlider'

import s from './FilterPanel.module.css'

type FilterPanelProps = {
  filters: FilterState
  onFiltersChange: (f: FilterState) => void
  disabled?: boolean
  /** Мобильный размер — явный проп вызывающей стороны (шторка), как у `ChipSelect`. */
  compact?: boolean
}

const RATINGS = [5, 6, 7, 8, 9]

const DURATION_ITEMS = [...DURATION_VALUES]
const PLATFORM_VALUES = PLATFORM_OPTIONS.map(o => o.value)
const LIST_VALUES = LIST_OPTIONS.map(o => o.value)

const toggleIn = (list: string[], value: string) =>
  list.includes(value) ? list.filter(v => v !== value) : [...list, value]

/**
 * Группы Genre/Year/Rating + новые фильтры; общий для `SearchSidebar` и шторки `Search`.
 * Type остаётся в контейнерах (разные контролы), сюда не входит.
 */
export const FilterPanel = ({
  filters,
  onFiltersChange,
  disabled,
  compact,
}: FilterPanelProps) => {
  const hasYear = filters.yearFrom !== null || filters.yearTo !== null

  return (
    <>
      <FilterGroup
        title='Genre'
        count={filters.genres.length}
        defaultOpen
        compact={compact}
      >
        <GenreSelector
          selected={filters.genres}
          onToggle={genre =>
            onFiltersChange({
              ...filters,
              genres: toggleIn(filters.genres, genre),
            })
          }
          disabled={disabled}
          compact={compact}
        />
      </FilterGroup>

      <FilterGroup
        title='Year'
        count={hasYear ? 1 : 0}
        defaultOpen
        compact={compact}
      >
        <YearRangeSlider
          yearFrom={filters.yearFrom}
          yearTo={filters.yearTo}
          onChange={(yearFrom, yearTo) =>
            onFiltersChange({ ...filters, yearFrom, yearTo })
          }
          disabled={disabled}
          compact={compact}
        />
      </FilterGroup>

      <FilterGroup
        title='Rating'
        count={filters.rating !== null ? 1 : 0}
        defaultOpen
        compact={compact}
      >
        <div
          className={`${s.ratingList} ${compact ? s.ratingListCompact : ''}`}
        >
          {RATINGS.map(r => (
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
              className={`${s.ratingBtn} ${compact ? s.ratingBtnCompact : ''} ${filters.rating === r ? s.ratingBtnActive : ''}`}
            >
              {r}+
            </button>
          ))}
        </div>
      </FilterGroup>

      {/* Новые группы закрыты, пока в них нет активного значения (deep link показывает их раскрытыми). */}
      <FilterGroup
        title='Country'
        count={filters.countries.length}
        defaultOpen={filters.countries.length > 0}
        compact={compact}
      >
        <CountrySelector
          selected={filters.countries}
          onToggle={country =>
            onFiltersChange({
              ...filters,
              countries: toggleIn(filters.countries, country),
            })
          }
          disabled={disabled}
          compact={compact}
        />
      </FilterGroup>

      <FilterGroup
        title='Duration'
        count={filters.duration !== null ? 1 : 0}
        defaultOpen={filters.duration !== null}
        compact={compact}
      >
        <ChipSelect
          items={DURATION_ITEMS}
          selected={filters.duration ? [filters.duration] : []}
          getLabel={getDurationLabel}
          onToggle={value =>
            onFiltersChange({
              ...filters,
              duration:
                filters.duration !== value && isDuration(value) ? value : null,
            })
          }
          disabled={disabled}
          compact={compact}
          groupLabel='Duration'
        />
      </FilterGroup>

      <FilterGroup
        title='Streaming'
        count={filters.platforms.length}
        defaultOpen={filters.platforms.length > 0}
        compact={compact}
      >
        <ChipSelect
          items={PLATFORM_VALUES}
          selected={filters.platforms}
          getLabel={getPlatformLabel}
          onToggle={value =>
            onFiltersChange({
              ...filters,
              platforms: toggleIn(filters.platforms, value),
            })
          }
          disabled={disabled}
          compact={compact}
          groupLabel='Streaming'
        />
      </FilterGroup>

      <FilterGroup
        title='Collection'
        count={filters.list !== null ? 1 : 0}
        defaultOpen={filters.list !== null}
        compact={compact}
      >
        <ChipSelect
          items={LIST_VALUES}
          selected={filters.list ? [filters.list] : []}
          getLabel={getListLabel}
          onToggle={value =>
            onFiltersChange({
              ...filters,
              list: filters.list === value ? null : value,
            })
          }
          disabled={disabled}
          compact={compact}
          groupLabel='Collection'
        />
      </FilterGroup>
    </>
  )
}
