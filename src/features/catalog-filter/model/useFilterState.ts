import { useState } from 'react'

export type FilterState = {
  type: string | null
  genres: string[]
  yearFrom: number | null
  yearTo: number | null
  rating: number | null
}

const DEFAULT_FILTERS: FilterState = {
  type: 'movie',
  genres: ['Drama'],
  yearFrom: 2020,
  yearTo: 2025,
  rating: 7,
}

export type ActiveChip = {
  label: string
  onRemove: () => void
}

export function useFilterState() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [sort, setSort] = useState('Popular')

  const toggleGenre = (g: string) => {
    setFilters((f) => ({
      ...f,
      genres: f.genres.includes(g) ? f.genres.filter((x) => x !== g) : [...f.genres, g],
    }))
  }

  const resetFilters = () => setFilters({ type: null, genres: [], yearFrom: null, yearTo: null, rating: null })

  const activeChips: ActiveChip[] = []
  if (filters.type) {
    const label = filters.type.charAt(0).toUpperCase() + filters.type.slice(1) + 's'
    activeChips.push({ label, onRemove: () => setFilters((f) => ({ ...f, type: null })) })
  }
  filters.genres.forEach((g) =>
    activeChips.push({ label: g, onRemove: () => toggleGenre(g) })
  )
  if (filters.yearFrom) {
    activeChips.push({
      label: `${filters.yearFrom}–${filters.yearTo}`,
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
