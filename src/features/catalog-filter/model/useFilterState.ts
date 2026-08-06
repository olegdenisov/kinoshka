import { useSearchParams } from 'react-router'
import { EMPTY_FILTERS, filtersToSearchParams, getFilterFromSearchParams } from '../lib/searchParams'

export type FilterState = {
  type: string | null
  genres: string[]
  yearFrom: number | null
  yearTo: number | null
  rating: number | null
}

export type ActiveChip = {
  label: string
  onRemove: () => void
}

const FILTER_KEYS = ['type', 'genres', 'yearFrom', 'yearTo', 'rating'] as const

/**
 * URL — единственный источник истины для фильтров и сортировки (`?type`, `?genres`,
 * `?yearFrom`, `?yearTo`, `?rating`, `?sort`). Хук не хранит собственный стейт —
 * каждое чтение выводится из `useSearchParams`, каждая запись идёт через
 * `setSearchParams(..., { replace: true })`, не задевая посторонние параметры (`?q`, `?page`).
 */
export const useFilterState = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = getFilterFromSearchParams(searchParams)
  const sort = searchParams.get('sort') ?? ''

  const applyFilters = (next: FilterState) => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        FILTER_KEYS.forEach((key) => params.delete(key))
        filtersToSearchParams(next).forEach((value, key) => params.set(key, value))
        return params
      },
      { replace: true },
    )
  }

  const setFilters = (next: FilterState | ((prev: FilterState) => FilterState)) => {
    applyFilters(typeof next === 'function' ? next(filters) : next)
  }

  const setSort = (next: string) => {
    setSearchParams(
      (prev) => {
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
    setFilters((f) => ({
      ...f,
      genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g],
    }))
  }

  const resetFilters = () => setFilters(EMPTY_FILTERS)

  const activeChips: ActiveChip[] = []
  if (filters.type) {
    const label = filters.type.charAt(0).toUpperCase() + filters.type.slice(1) + 's'
    activeChips.push({ label, onRemove: () => setFilters((f) => ({ ...f, type: null })) })
  }
  filters.genres.forEach((g) =>
    activeChips.push({ label: g, onRemove: () => toggleGenre(g) })
  )
  if (filters.yearFrom || filters.yearTo) {
    // yearFrom/yearTo — независимые nullable-поля (валидный FilterState допускает только
    // один из них заданным), поэтому не склеиваем "2020–null"/"null–2025" вслепую.
    const label =
      filters.yearFrom && filters.yearTo
        ? `${filters.yearFrom}–${filters.yearTo}`
        : filters.yearFrom
          ? `${filters.yearFrom}+`
          : `–${filters.yearTo}`
    activeChips.push({
      label,
      onRemove: () => setFilters((f) => ({ ...f, yearFrom: null, yearTo: null })),
    })
  }
  if (filters.rating) {
    activeChips.push({
      label: `Rating ${filters.rating}+`,
      onRemove: () => setFilters((f) => ({ ...f, rating: null })),
    })
  }

  return { filters, setFilters, sort, setSort, toggleGenre, resetFilters, activeChips }
}
