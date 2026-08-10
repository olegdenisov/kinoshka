import type { MovieControllerFindManyByQueryV15Data } from '@shared/api'
import type { FilterState } from '../model/useFilterState'
import { toApiGenre } from './genreMap'

export type CatalogQueryParams = NonNullable<MovieControllerFindManyByQueryV15Data['query']>

type ApiMovieType = NonNullable<CatalogQueryParams['type']>[number]
type ApiSortField = NonNullable<CatalogQueryParams['sortField']>[number]

/** UI type-фильтр ('movie'/'series'/'anime') → валидные значения API (v1.5 не знает 'series', только 'tv-series'). */
const TYPE_MAP: Record<string, ApiMovieType> = {
  movie: 'movie',
  series: 'tv-series',
  anime: 'anime',
}

/** Лейблы сортировки (см. SearchMobile SORT_OPTIONS) → sortField/sortType API v1.5. */
const SORT_MAP: Record<string, { field: ApiSortField; type: string }> = {
  'Popular': { field: 'votes.kp', type: '-1' },
  'Newest': { field: 'year', type: '-1' },
  'Highest rated': { field: 'rating.kp', type: '-1' },
  'Most watched': { field: 'votes.imdb', type: '-1' },
  'A to Z': { field: 'name', type: '1' },
}

/** Лейблы сортировки в порядке отображения — единственный источник истины для UI (desktop `SortSelect`, mobile `BottomSheet`). */
export const SORT_LABELS = Object.keys(SORT_MAP)

const PAGE_LIMIT = 10

/**
 * Границы года открытого диапазона, когда задан только `yearFrom` или только `yearTo`
 * (напр. `?yearFrom=2020` — "2020 и позже"). Значения взяты из документации API v1.5
 * (`year`: пример `1874, 2050, !2020, 2020-2024`) — 1874/2050 это её собственные примеры
 * минимального/максимального года, а не произвольная константа. Это держит фактический
 * API-запрос в согласии с чипом фильтра в `useFilterState` (`"2020+"` / `"–2010"`),
 * а не сужает его до точного года.
 */
const YEAR_RANGE_MIN = 1874
const YEAR_RANGE_MAX = 2050

/**
 * Чистая функция: FilterState (+опциональный лейбл сортировки) → query-параметры
 * для `getV15Movie` (каталог, без текстового поиска — Variant A).
 * Пустой фильтр без sort даёт минимальный `{ limit: 10 }`.
 */
export const filtersToParams = (filters: FilterState, sort?: string): CatalogQueryParams => {
  const params: CatalogQueryParams = { limit: PAGE_LIMIT }

  const apiType = filters.type ? TYPE_MAP[filters.type] : undefined
  if (apiType) {
    params.type = [apiType]
  }

  const apiGenres = filters.genres
    .map(toApiGenre)
    .filter((genre): genre is string => Boolean(genre))
  if (apiGenres.length > 0) {
    params['genres.name'] = apiGenres
  }

  if (filters.yearFrom != null || filters.yearTo != null) {
    const from = filters.yearFrom ?? YEAR_RANGE_MIN
    const to = filters.yearTo ?? YEAR_RANGE_MAX
    params.year = [`${from}-${to}`]
  }

  if (filters.rating != null) {
    params['rating.kp'] = [`${filters.rating}-10`]
  }

  const sortMapping = sort ? SORT_MAP[sort] : undefined
  if (sortMapping) {
    params.sortField = [sortMapping.field]
    params.sortType = [sortMapping.type]
  }

  return params
}
