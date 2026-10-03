export { ActiveFilterChips } from './ui/ActiveFilterChips'
export type { FilterState } from './model/types'
export type { FilterChip } from './lib/filterChips'
export {
  QUERY_MIN_LENGTH,
  QUERY_DEBOUNCE_MS,
  searchQuery,
  page,
  sort,
  filters,
  activeChips,
  catalogParams,
  setFilters,
  setSort,
  resetFilters,
  removeFilterChip,
  goToPage,
  normalizeSearchUrl,
  searchDraft,
  commitSearchDraft,
  submitSearchQuery,
} from './model/searchState'
export { filtersToParams, SORT_LABELS } from './lib/filtersToParams'
export type { CatalogQueryParams } from './lib/filtersToParams'
export {
  getFilterFromSearchParams,
  filtersToSearchParams,
  stripFilterAndSortParams,
  resetPageToOne,
  EMPTY_FILTERS,
} from './lib/searchParams'
export { FilterPanel } from './ui/FilterPanel'
// Type в контейнерах (сайдбар/шторка) рендерится своими контролами, но оборачивается в тот же FilterGroup.
export { FilterGroup } from './ui/FilterGroup'
