import { type FilterState, TYPE_LABELS } from '../model/types'
import {
  getCountryLabel,
  getDurationLabel,
  getListLabel,
  getPlatformLabel,
} from './filterOptions'
import { getGenreLabel } from './genreMap'

/** Чип активного фильтра без замыканий: снимается по `id` (`removeFilterChip`). */
export type FilterChip = {
  id: string
  label: string
}

// yearFrom/yearTo — независимые nullable-поля (валидный FilterState допускает только один из
// них заданным), поэтому не склеиваем "2020–null"/"null–2025" вслепую.
const yearLabel = ({ yearFrom, yearTo }: FilterState) => {
  if (yearFrom && yearTo) return `${yearFrom}–${yearTo}`
  return yearFrom ? `${yearFrom}+` : `–${yearTo}`
}

export const getFilterChips = (filters: FilterState): FilterChip[] => {
  const chips: FilterChip[] = []

  if (filters.type) {
    chips.push({
      id: 'type',
      label: TYPE_LABELS[filters.type] ?? filters.type,
    })
  }
  filters.genres.forEach(g =>
    chips.push({ id: `genre:${g}`, label: getGenreLabel(g) }),
  )
  if (filters.yearFrom || filters.yearTo) {
    chips.push({ id: 'year', label: yearLabel(filters) })
  }
  if (filters.rating) {
    chips.push({ id: 'rating', label: `Rating ${filters.rating}+` })
  }
  filters.countries.forEach(c =>
    chips.push({ id: `country:${c}`, label: getCountryLabel(c) }),
  )
  if (filters.duration) {
    chips.push({ id: 'duration', label: getDurationLabel(filters.duration) })
  }
  filters.platforms.forEach(p =>
    chips.push({ id: `platform:${p}`, label: getPlatformLabel(p) }),
  )
  if (filters.list) {
    chips.push({ id: 'list', label: getListLabel(filters.list) })
  }

  return chips
}

const without = (values: string[], value: string) =>
  values.filter(v => v !== value)

/** FilterState без фильтра чипа `id`; неизвестный `id` возвращает фильтры как есть. */
export const removeChipFromFilters = (
  filters: FilterState,
  id: string,
): FilterState => {
  const separator = id.indexOf(':')
  const kind = separator === -1 ? id : id.slice(0, separator)
  const value = separator === -1 ? '' : id.slice(separator + 1)

  switch (kind) {
    case 'type':
      return { ...filters, type: null }
    case 'genre':
      return { ...filters, genres: without(filters.genres, value) }
    case 'year':
      return { ...filters, yearFrom: null, yearTo: null }
    case 'rating':
      return { ...filters, rating: null }
    case 'country':
      return { ...filters, countries: without(filters.countries, value) }
    case 'duration':
      return { ...filters, duration: null }
    case 'platform':
      return { ...filters, platforms: without(filters.platforms, value) }
    case 'list':
      return { ...filters, list: null }
    default:
      return filters
  }
}
