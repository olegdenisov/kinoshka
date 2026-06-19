import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { filtersToParams, getFilterFromSearchParams } from '../libs'
import type { FilterState } from '../type'

export type ActiveChip = {
  label: string
  onRemove: () => void
}

export function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [sort, setSort] = useState('Popular')
  const filters = getFilterFromSearchParams(searchParams)

  const setFilters = (f: FilterState) => {
    setSearchParams(filtersToParams(f))
  }

  const toggleGenre = (g: string) => {
    const newGenres = filters.genres.includes(g) ? filters.genres.filter((x) => x !== g) : [...filters.genres, g]
    
    setFilters({ ...filters, genres: newGenres })
  }

  const resetFilters = () => {
    setSearchParams({})
  }

  const activeChips: ActiveChip[] = []
  if (filters.type) {
    const label = filters.type.charAt(0).toUpperCase() + filters.type.slice(1) + 's'
    activeChips.push({ label, onRemove: () => setFilters({ ...filters, type: null }) })
  }
  filters.genres.forEach((g) =>
    activeChips.push({ 
      label: g.charAt(0).toUpperCase() + g.slice(1), 
      onRemove: () => toggleGenre(g) })
  )
  if (filters.yearFrom) {
    activeChips.push({
      label: `${filters.yearFrom}–${filters.yearTo}`,
      onRemove: () => setFilters({ ...filters, yearFrom: null, yearTo: null }),
    })
  }
  if (filters.rating) {
    activeChips.push({
      label: `Rating ${filters.rating}+`,
      onRemove: () => setFilters({ ...filters, rating: null }),
    })
  }

  return { filters, setFilters, sort, setSort, toggleGenre, resetFilters, activeChips }
}
