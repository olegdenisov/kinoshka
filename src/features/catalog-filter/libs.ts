import type { MovieType } from "@entities/movie"
import type { FilterState } from "./type"

export const getFilterFromSearchParams = (searchParams: URLSearchParams) => {
  const filters: FilterState = {
    type: searchParams.get('type') as MovieType | null,
    genres: searchParams.getAll('genres'),
    yearFrom: parseInt(searchParams.get('yearFrom') ?? '2020'),
    yearTo: parseInt(searchParams.get('yearTo') ?? new Date().getFullYear().toString()),
    rating: parseInt(searchParams.get('rating') ?? '7'),
    q: searchParams.get('q')
  }

  return filters
}

export const filtersToParams = (f: FilterState): Record<string, string> => {
   const p: Record<string, string> = {}
   if (f.type) p.type = f.type
   if (f.genres.length) p.genres = f.genres.join(',')
   if (f.yearFrom != null) p.yearFrom = String(f.yearFrom)
   if (f.yearTo != null) p.yearTo = String(f.yearTo)
   if (f.rating != null) p.rating = String(f.rating)
  if (f.q) p.q = f.q
  return p
}