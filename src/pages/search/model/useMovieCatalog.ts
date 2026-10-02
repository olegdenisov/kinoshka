import { filtersToParams } from '@features/catalog-filter'
import type { FilterState } from '@features/catalog-filter'
import type { QueryResult } from '@shared/lib'

import {
  movieCatalogStore,
  type MovieCatalogKey,
  type MovieCatalogResult,
} from './movieCatalogStore'

export type MovieCatalogParams = {
  query: string
  filters: FilterState
  sort: string
  page: number
}

/**
 * Фасад page-слоя: скрывает двухэндпоинтную реальность API (query и фильтры не сочетаются
 * в одном запросе). `filtersToParams` из `@features/catalog-filter` и сторы из `@entities/movie`
 * — оба вниз по FSD, легально только в page-слое.
 *
 * keepPreviousData: смена страницы/фильтра/режима держит прежнюю сетку, `isFetching` —
 * индикатор «Updating…».
 */
export const useMovieCatalog = ({
  query,
  filters,
  sort,
  page,
}: MovieCatalogParams): QueryResult<MovieCatalogResult> => {
  const trimmedQuery = query.trim()
  const key: MovieCatalogKey = trimmedQuery
    ? { query: trimmedQuery, params: {}, page }
    : { query: '', params: filtersToParams(filters, sort), page }

  return movieCatalogStore.useQuery(key, { keepPreviousData: true })
}
