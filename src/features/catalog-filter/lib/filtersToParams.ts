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

const PAGE_LIMIT = 10

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
    const from = filters.yearFrom ?? filters.yearTo
    const to = filters.yearTo ?? filters.yearFrom
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
