import { useGetCatalogQuery } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { filtersToParams } from '@features/catalog-filter'
import type { FilterState } from '@features/catalog-filter'
import type { QueryBoundaryQuery } from '@shared/ui'

// не публичный тип: используется только ниже в MovieCatalogData (knip флагует export как
// мёртвый — этот файл page-internal, не реэкспортируется через публичный index.ts)
type CatalogMode = 'search' | 'catalog'

export type MovieCatalogParams = {
  query: string
  filters: FilterState
  sort: string
  page: number
}

type MovieCatalogData = {
  movies: Movie[]
  mode: CatalogMode
  // query, по которому получены movies (а не живой ввод) — для текста пустого результата
  query: string
  totalPages: number
}

/**
 * Фасад page-слоя: скрывает двухэндпоинтную реальность API (query и фильтры не сочетаются в
 * одном запросе) за одним RTK Query-хуком `useGetCatalogQuery`. Импорт `filtersToParams` из
 * `@features/catalog-filter` и хука из `@entities/movie` легален только в page-слое.
 *
 * Stale-while-fetching даёт сам RTK Query: `data` держит результат предыдущих аргументов, пока
 * грузятся новые (в том числе при смене режима поиск ↔ каталог — endpoint один). Отсюда
 * `isUpdating` = идёт запрос при уже показанных данных.
 */
export const useMovieCatalog = ({
  query,
  filters,
  sort,
  page,
}: MovieCatalogParams): QueryBoundaryQuery<MovieCatalogData> & {
  isFetching: boolean
  isUpdating: boolean
} => {
  const trimmedQuery = query.trim()

  // В search-режиме params не передаём: фильтры с текстом API не сочетает, и ключ кеша
  // не должен от них зависеть.
  const { data, isLoading, isFetching, isError, error, refetch } =
    useGetCatalogQuery(
      trimmedQuery
        ? { query: trimmedQuery, page }
        : { query: '', params: filtersToParams(filters, sort), page },
    )

  // mode и query — из аргументов, с которыми получены data: пока грузится новый режим, data
  // ещё прежние, и живой query дал бы им чужой текст пустого результата.
  const catalog: MovieCatalogData | undefined = data && {
    movies: data.movies,
    mode: data.query ? 'search' : 'catalog',
    query: data.query,
    totalPages: data.totalPages,
  }

  return {
    data: catalog,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    isUpdating: isFetching && !isLoading,
  }
}
