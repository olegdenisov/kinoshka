import { z } from 'zod'
import type { FilterState } from '../model/useFilterState'

/** Пустой FilterState — дефолт как для пустого URL, так и для мусорных значений в нём. */
export const EMPTY_FILTERS: FilterState = {
  type: null,
  genres: [],
  yearFrom: null,
  yearTo: null,
  rating: null,
}

// Zod-схема границы URL: мусор (нечисловой год/рейтинг вне 0-10 и т.п.) → весь FilterState
// откатывается на EMPTY_FILTERS, а не падает и не протаскивает частично невалидные значения.
const FilterStateSchema = z.object({
  type: z.string().nullable(),
  genres: z.array(z.string()),
  yearFrom: z.number().finite().int().nullable(),
  yearTo: z.number().finite().int().nullable(),
  rating: z.number().finite().min(0).max(10).nullable(),
}) satisfies z.ZodType<FilterState>

const parseIntOrNull = (raw: string | null): number | null => {
  if (raw === null || raw === '') {
    return null
  }
  return Number(raw)
}

/** URLSearchParams → FilterState. Невалидные/мусорные значения → EMPTY_FILTERS (не крашит). */
export const getFilterFromSearchParams = (searchParams: URLSearchParams): FilterState => {
  const rawGenres = searchParams.get('genres')

  const candidate = {
    type: searchParams.get('type') || null,
    genres: rawGenres ? rawGenres.split(',').filter(Boolean) : [],
    yearFrom: parseIntOrNull(searchParams.get('yearFrom')),
    yearTo: parseIntOrNull(searchParams.get('yearTo')),
    rating: parseIntOrNull(searchParams.get('rating')),
  }

  const parsed = FilterStateSchema.safeParse(candidate)

  return parsed.success ? parsed.data : EMPTY_FILTERS
}

/** FilterState → URLSearchParams. Пустые/дефолтные поля не пишем в URL. */
export const filtersToSearchParams = (filters: FilterState): URLSearchParams => {
  const params = new URLSearchParams()

  if (filters.type) {
    params.set('type', filters.type)
  }
  if (filters.genres.length > 0) {
    params.set('genres', filters.genres.join(','))
  }
  if (filters.yearFrom != null) {
    params.set('yearFrom', String(filters.yearFrom))
  }
  if (filters.yearTo != null) {
    params.set('yearTo', String(filters.yearTo))
  }
  if (filters.rating != null) {
    params.set('rating', String(filters.rating))
  }

  return params
}
