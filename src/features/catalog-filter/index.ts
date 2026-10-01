export { ActiveFilterChips } from './ui/ActiveFilterChips'
export { useFilterState } from './model/useFilterState'
export type { FilterState, ActiveChip } from './model/useFilterState'
export { filtersToParams, SORT_LABELS } from './lib/filtersToParams'
export type { CatalogQueryParams } from './lib/filtersToParams'
export {
  getFilterFromSearchParams,
  filtersToSearchParams,
  stripFilterAndSortParams,
  EMPTY_FILTERS,
} from './lib/searchParams'
export { FilterPanel } from './ui/FilterPanel'
// Type в контейнерах (сайдбар/шторка) рендерится своими контролами, но оборачивается в тот же FilterGroup.
export { FilterGroup } from './ui/FilterGroup'
