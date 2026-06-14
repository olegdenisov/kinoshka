import type { MovieType } from '@entities/movie'
import { useState } from 'react'
import { useSearchParams } from 'react-router'

export type FilterState = {
  type: MovieType | null
  genres: string[]
  yearFrom: number | null
  yearTo: number | null
  rating: number | null
}

export type ActiveChip = {
  label: string
  onRemove: () => void
}

const getFilterFromSearchParams = (searchParams: URLSearchParams) => {
  const filters: FilterState = {
    type: searchParams.get('type') as MovieType | null,
    genres: searchParams.getAll('genres'),
    yearFrom: parseInt(searchParams.get('yearFrom') ?? '2020'),
    yearTo: parseInt(searchParams.get('yearTo') ?? new Date().getFullYear().toString()),
    rating: parseInt(searchParams.get('rating') ?? '7'),
  }

  return filters
}

const filtersToParams = (f: FilterState): Record<string, string> => {
   const p: Record<string, string> = {}
   if (f.type) p.type = f.type
   if (f.genres.length) p.genres = f.genres.join(',')
   if (f.yearFrom != null) p.yearFrom = String(f.yearFrom)
   if (f.yearTo != null) p.yearTo = String(f.yearTo)
   if (f.rating != null) p.rating = String(f.rating)
   return p
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
