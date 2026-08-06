import { useDeferredValue, useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
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
 * **Зеркало через `useState`/`useEffect` (найдено интеграционным тестом Task 8, а не заложено в
 * исходном дизайне Task 5).** `query`/`filters`/`sort`/`page` приходят из `useSearchParams()`, чей
 * апдейтер `setSearchParams` react-router сам оборачивает в `React.startTransition` (см. Context в
 * плане; подтверждено чтением `node_modules/react-router/dist/development/dom-export.js`). Если
 * навесить `useDeferredValue` прямо на эти значения, рендер, в котором они меняются, уже идёт в
 * неурочном (transition) lane — React видит это через внутренний `includesOnlyNonUrgentLanes` и
 * отдаёт НОВОЕ значение немедленно, без промежуточной stale-стадии: `deferredPage` и `page`
 * меняются в один и тот же коммит, `isUpdating` ни разу не становится `true`, индикатор не
 * загорается никогда — баг, невидимый в прежних smoke-тестах Task 6/7 (они проверяли только
 * итоговое состояние после клика, а не сам момент "запрос ушёл, ответа ещё нет"). Зеркалим
 * live-значения в локальный `useState`, но апдейтер зовём не прямо в теле эффекта (это поймал бы
 * `react-hooks/set-state-in-effect` как классический анти-паттерн "derive state from props в
 * эффекте", и линтер прав — это была бы лишняя каскадная перерисовка, если бы не была нужна сама
 * смена lane), а через `flushSync` внутри эффекта: `flushSync` форсирует синхронный коммит вне
 * текущей транзишн-области react-router, поэтому апдейт идёт в urgent lane — именно на этом
 * зеркале `useDeferredValue` отрабатывает по назначению и по-настоящему временно расходится с
 * live-значением на время фетча. (Пробовали `queueMicrotask` вместо `flushSync` — избегает того
 * же lint-правила, но гоняет пере-рендер мирового значения через отдельный микротаск, что даёт
 * гонку с `waitFor` в тестах: синхронная первая проверка успевает случайно попасть между "эффект
 * ещё не отработал" и "апдейт уже применился, но deferred ещё не догнал" — `flushSync` убирает
 * этот промежуточный асинхронный шаг, апдейт зеркала происходит синхронно в момент эффекта.)
 *
 * Подключён в `SearchDesktop`/`SearchMobile` (Task 6/7).
 */
export const useCatalogUpdateStatus = ({
  query,
  filters,
  sort,
  page,
}: CatalogUpdateStatusParams): CatalogUpdateStatusResult => {
  const [liveQuery, setLiveQuery] = useState(query)
  const [liveFilters, setLiveFilters] = useState(filters)
  const [liveSort, setLiveSort] = useState(sort)
  const [livePage, setLivePage] = useState(page)

  useEffect(() => {
    flushSync(() => setLiveQuery(query))
  }, [query])
  useEffect(() => {
    flushSync(() => setLiveFilters(filters))
  }, [filters])
  useEffect(() => {
    flushSync(() => setLiveSort(sort))
  }, [sort])
  useEffect(() => {
    flushSync(() => setLivePage(page))
  }, [page])

  const deferredQuery = useDeferredValue(liveQuery)
  const deferredFilters = useDeferredValue(liveFilters)
  const deferredSort = useDeferredValue(liveSort)
  const deferredPage = useDeferredValue(livePage)

  const liveKey = `${liveQuery}|${JSON.stringify(liveFilters)}|${liveSort}|${livePage}`
  const deferredKey = `${deferredQuery}|${JSON.stringify(deferredFilters)}|${deferredSort}|${deferredPage}`

  return {
    deferredQuery,
    deferredFilters,
    deferredSort,
    deferredPage,
    isUpdating: liveKey !== deferredKey,
  }
}
