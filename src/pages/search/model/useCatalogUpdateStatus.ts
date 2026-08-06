import { useDeferredValue } from 'react'
import type { FilterState } from '@features/catalog-filter'

export type CatalogUpdateStatusParams = {
  query: string
  filters: FilterState
  sort: string
  page: number
}

export type CatalogUpdateStatusResult = {
  deferredQuery: string
  deferredFilters: FilterState
  deferredSort: string
  deferredPage: number
  isUpdating: boolean
}

/**
 * Page-internal facade (Task 5, план `docs/plans/20260806-search-loading-indicator-and-filter-reset.md`)
 * для "stale content while fetching" паттерна на `/search`: вместо `useTransition`/`useNavigation`
 * (не работают — роуты без `loader`, см. Context в плане) применяем `useDeferredValue` к каждому
 * параметру запроса. React коммитит рендер со старыми (deferred) значениями сразу, затем в фоне
 * пересчитывает с новыми — поэтому `SearchResults` должен рендериться от `deferred*`, а не от live
 * `query`/`filters`/`sort`/`page` (см. Task 6/7), чтобы `use()` внутри `useMovieCatalog` не саспенднул
 * дерево заново на уже смонтированном Suspense-поддереве.
 *
 * `isUpdating` — сравнение `liveKey`/`deferredKey` через `JSON.stringify` (аналогично `resetKey` в
 * `usePageSync`): пока они расходятся, где-то в дереве идёт незавершённый deferred-рендер — самый
 * дешёвый способ понять "мы ещё не догнали live-параметры", не подписываясь на состояние Suspense
 * напрямую.
 *
 * Ещё не подключён ни в один UI-компонент (см. Task 6/7) — только сам хук.
 */
export const useCatalogUpdateStatus = ({
  query,
  filters,
  sort,
  page,
}: CatalogUpdateStatusParams): CatalogUpdateStatusResult => {
  const deferredQuery = useDeferredValue(query)
  const deferredFilters = useDeferredValue(filters)
  const deferredSort = useDeferredValue(sort)
  const deferredPage = useDeferredValue(page)

  const liveKey = `${query}|${JSON.stringify(filters)}|${sort}|${page}`
  const deferredKey = `${deferredQuery}|${JSON.stringify(deferredFilters)}|${deferredSort}|${deferredPage}`

  return {
    deferredQuery,
    deferredFilters,
    deferredSort,
    deferredPage,
    isUpdating: liveKey !== deferredKey,
  }
}
