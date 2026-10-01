import { z } from 'zod'

import type { FilterState } from '../model/useFilterState'
import { DURATION_VALUES } from './filterOptions'

/** URL-ключи фильтров (без сортировки) — используются и для чтения/записи, и для удаления. */
export const FILTER_URL_KEYS = [
  'type',
  'genres',
  'yearFrom',
  'yearTo',
  'rating',
  'countries',
  'duration',
  'platforms',
  'list',
] as const

/**
 * Фильтры + сортировка — полный набор ключей, которые нужно зачищать при входе в текстовый
 * поиск. Не публичный экспорт: используется только в stripFilterAndSortParams ниже (knip
 * флагует export как мёртвый — не реэкспортируется через публичный барель).
 */
const FILTER_AND_SORT_URL_KEYS = [...FILTER_URL_KEYS, 'sort'] as const

/** Пустой FilterState — дефолт как для пустого URL, так и для мусорных значений в нём. */
export const EMPTY_FILTERS: FilterState = {
  type: null,
  genres: [],
  yearFrom: null,
  yearTo: null,
  rating: null,
  countries: [],
  duration: null,
  platforms: [],
  list: null,
}

// Zod-схема границы URL: мусор (нечисловой год/рейтинг вне 0-10 и т.п.) → весь FilterState
// откатывается на EMPTY_FILTERS, а не падает и не протаскивает частично невалидные значения.
const FilterStateSchema = z.object({
  type: z.string().nullable(),
  genres: z.array(z.string()),
  yearFrom: z.number().finite().int().nullable(),
  yearTo: z.number().finite().int().nullable(),
  rating: z.number().finite().min(0).max(10).nullable(),
  countries: z.array(z.string()),
  duration: z.enum(DURATION_VALUES).nullable(),
  platforms: z.array(z.string()),
  list: z.string().nullable(),
}) satisfies z.ZodType<FilterState>

const parseIntOrNull = (raw: string | null): number | null => {
  if (raw === null || raw === '') {
    return null
  }
  return Number(raw)
}

const parseCsv = (raw: string | null): string[] =>
  raw ? raw.split(',').filter(Boolean) : []

/** URLSearchParams → FilterState. Невалидные/мусорные значения → EMPTY_FILTERS (не крашит). */
export const getFilterFromSearchParams = (
  searchParams: URLSearchParams,
): FilterState => {
  const candidate = {
    type: searchParams.get('type') || null,
    genres: parseCsv(searchParams.get('genres')),
    yearFrom: parseIntOrNull(searchParams.get('yearFrom')),
    yearTo: parseIntOrNull(searchParams.get('yearTo')),
    rating: parseIntOrNull(searchParams.get('rating')),
    countries: parseCsv(searchParams.get('countries')),
    duration: searchParams.get('duration') || null,
    platforms: parseCsv(searchParams.get('platforms')),
    list: searchParams.get('list') || null,
  }

  const parsed = FilterStateSchema.safeParse(candidate)

  return parsed.success ? parsed.data : EMPTY_FILTERS
}

/** FilterState → URLSearchParams. Пустые/дефолтные поля не пишем в URL. */
export const filtersToSearchParams = (
  filters: FilterState,
): URLSearchParams => {
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
  if (filters.countries.length > 0) {
    params.set('countries', filters.countries.join(','))
  }
  if (filters.duration) {
    params.set('duration', filters.duration)
  }
  if (filters.platforms.length > 0) {
    params.set('platforms', filters.platforms.join(','))
  }
  if (filters.list) {
    params.set('list', filters.list)
  }

  return params
}

/**
 * Возвращает новый URLSearchParams без ключей фильтров и сортировки (`?q`/`?page` не трогает).
 * Не мутирует переданный `params` — используется при атомарной сборке апдейта в одном
 * `setSearchParams` (см. `usePageSync`).
 */
export const stripFilterAndSortParams = (
  params: URLSearchParams,
): URLSearchParams => {
  const next = new URLSearchParams(params)
  FILTER_AND_SORT_URL_KEYS.forEach(key => next.delete(key))
  return next
}
