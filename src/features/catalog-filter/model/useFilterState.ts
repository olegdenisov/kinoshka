import { trackEvent } from '@shared/lib'
import { useSearchParams } from 'react-router'

import { getFilterChips, removeChipFromFilters } from '../lib/filterChips'
import {
  EMPTY_FILTERS,
  FILTER_URL_KEYS,
  filtersToSearchParams,
  getFilterFromSearchParams,
} from '../lib/searchParams'
import type { FilterState } from './types'

export type ActiveChip = {
  label: string
  onRemove: () => void
}

/**
 * URL — единственный источник истины для фильтров и сортировки (`?type`, `?genres`,
 * `?yearFrom`, `?yearTo`, `?rating`, `?countries`, `?duration`, `?platforms`, `?list`, `?sort`). Хук не хранит собственный стейт —
 * каждое чтение выводится из `useSearchParams`, каждая запись идёт через
 * `setSearchParams(..., { replace: true })`, не задевая посторонние параметры (`?q`, `?page`).
 */
export const useFilterState = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = getFilterFromSearchParams(searchParams)
  const sort = searchParams.get('sort') ?? ''

  const applyFilters = (next: FilterState) => {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        FILTER_URL_KEYS.forEach(key => params.delete(key))
        filtersToSearchParams(next).forEach((value, key) =>
          params.set(key, value),
        )
        return params
      },
      { replace: true },
    )
    // Единственная точка коммита FilterState в URL (setFilters/toggleGenre/сброс года/рейтинга
    // идут через неё) — setSort трекается отдельно и намеренно не проходит через applyFilters.
    trackEvent('filter changed')
  }

  const setFilters = (
    next: FilterState | ((prev: FilterState) => FilterState),
  ) => {
    applyFilters(typeof next === 'function' ? next(filters) : next)
  }

  const setSort = (next: string) => {
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        if (next) {
          params.set('sort', next)
        } else {
          params.delete('sort')
        }
        return params
      },
      { replace: true },
    )
  }

  const toggleGenre = (g: string) => {
    setFilters(f => ({
      ...f,
      genres: f.genres.includes(g)
        ? f.genres.filter(x => x !== g)
        : [...f.genres, g],
    }))
  }

  const resetFilters = () => setFilters(EMPTY_FILTERS)

  const activeChips: ActiveChip[] = getFilterChips(filters).map(chip => ({
    label: chip.label,
    onRemove: () => setFilters(f => removeChipFromFilters(f, chip.id)),
  }))

  return {
    filters,
    setFilters,
    sort,
    setSort,
    toggleGenre,
    resetFilters,
    activeChips,
  }
}
