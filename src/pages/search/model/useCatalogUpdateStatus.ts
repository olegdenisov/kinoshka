import { useDeferredValue, useEffect, useState } from 'react'
import type { FilterState } from '@features/catalog-filter'

const areFiltersEqual = (a: FilterState, b: FilterState): boolean =>
  a.type === b.type &&
  a.yearFrom === b.yearFrom &&
  a.yearTo === b.yearTo &&
  a.rating === b.rating &&
  a.genres.length === b.genres.length &&
  a.genres.every((genre, index) => genre === b.genres[index])

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
 * (не работают — роуты без `loader`, см. Context в плане) применяем `useDeferredValue` к параметрам
 * запроса. React коммитит рендер со старыми (deferred) значениями сразу, затем в фоне пересчитывает
 * с новыми — поэтому `SearchResults` должен рендериться от `deferred*`, а не от live
 * `query`/`filters`/`sort`/`page` (см. Task 6/7), чтобы `use()` внутри `useMovieCatalog` не саспенднул
 * дерево заново на уже смонтированном Suspense-поддереве.
 *
 * **Одно зеркало на все 4 параметра, не четыре (ревью-фаза, исправлено после первой реализации).**
 * `query`/`filters`/`sort`/`page` приходят из `useSearchParams()`, чей апдейтер `setSearchParams`
 * react-router сам оборачивает в `React.startTransition` (см. Context в плане; подтверждено чтением
 * `node_modules/react-router/dist/development/dom-export.js`). Если навесить `useDeferredValue` прямо
 * на эти значения, рендер, в котором они меняются, уже идёт в неурочном (transition) lane — React
 * видит это через внутренний `includesOnlyNonUrgentLanes` и отдаёт НОВОЕ значение немедленно, без
 * промежуточной stale-стадии: `deferredPage` и `page` меняются в один и тот же коммит, `isUpdating`
 * ни разу не становится `true`, индикатор не загорается никогда (баг, найденный интеграционным
 * тестом Task 8). Чтобы `useDeferredValue` реально стадировал значение, live-параметры зеркалятся в
 * локальный `useState` — апдейт зеркала происходит в `useEffect` (эффекты запускаются после коммита,
 * вне транзишн-области react-router, поэтому это уже urgent-апдейт) — именно на этом зеркале
 * `useDeferredValue` временно расходится с live-значением на время фетча.
 *
 * Одно зеркало над `{query, filters, sort, page}` целиком, а не четыре независимых
 * `useState`/`useEffect` на каждое поле по отдельности: при атомарном изменении нескольких URL-
 * параметров одним `setSearchParams` (напр. Task 2 — вход в поиск разом стрипает фильтры/сортировку
 * и сбрасывает `?page`) четыре отдельных эффекта фиксировали бы четыре последовательных
 * зеркальных коммита вместо одного, с промежуточными состояниями, где часть полей уже новая,
 * а часть ещё старая — комбинации, которых как реального URL-состояния никогда не существовало.
 * Один `useState` на объект + один `useEffect` коммитят зеркало атомарно за один рендер.
 *
 * Апдейтер зовётся прямо в теле эффекта — обычно это ловит `react-hooks/set-state-in-effect` как
 * анти-паттерн "derive state from props в эффекте", и линтер в целом прав (лишняя каскадная
 * перерисовка) — но здесь каскад нужен: это единственный способ вывести апдейт из transition-lane
 * react-router в urgent lane, на котором `useDeferredValue` ниже способен отработать по назначению.
 * (Ранее здесь стоял `flushSync` вместо обычного `setState` — думали, что синхронный коммит
 * обязателен, чтобы "выйти" из транзишн-области; на деле `flushSync` внутри эффекта форсирует
 * коммит прямо во время рендер-фазы другого коммита, из-за чего React предупреждает в консоли
 * "flushSync was called from inside a lifecycle method" на каждый маунт/апдейт — реальный runtime-
 * warning без какой-либо выгоды: обычный `setState` из эффекта уже происходит вне текущего рендера
 * и не наследует его lane, этого достаточно.)
 *
 * `isUpdating` — сравнение зеркала (`live`) с `useDeferredValue(live)` по ссылке: `live` — новый
 * объект на каждый апдейт зеркала, `useDeferredValue` его не клонирует, так что пока deferred
 * держит предыдущую ссылку, идёт незавершённый deferred-рендер. Дешевле и точнее, чем сравнение
 * через `JSON.stringify` (объект либо тот же самый, либо явно другой — сериализовывать нечего).
 *
 * Подключён в `SearchDesktop`/`SearchMobile` (Task 6/7).
 */
export const useCatalogUpdateStatus = ({
  query,
  filters,
  sort,
  page,
}: CatalogUpdateStatusParams): CatalogUpdateStatusResult => {
  const [live, setLive] = useState<CatalogUpdateStatusParams>({
    query,
    filters,
    sort,
    page,
  })

  useEffect(() => {
    // Зеркалим live URL-derived значения в локальный useState НАМЕРЕННО, а не по недосмотру:
    // react-router оборачивает setSearchParams в startTransition, поэтому useDeferredValue,
    // навешенный прямо на эти значения, никогда не видит промежуточную stale-стадию (см.
    // докблок выше). Апдейт зеркала из эффекта — единственный способ перевести его в urgent
    // lane, на котором useDeferredValue отрабатывает по назначению.
    //
    // Пропускаем setLive, если входящие значения по факту совпадают с текущим зеркалом
    // (ревью-фаза 2, исправлено после первой реализации): `filters` — новый объект на каждый
    // рендер (пересчитывается заново в `getFilterFromSearchParams`), поэтому сравнение по
    // ссылке всегда даёт "изменилось" даже когда содержимое то же самое — включая самый первый
    // прогон эффекта сразу после mount, когда query/filters/sort/page ещё не менялись вовсе.
    // Без этой проверки `setLive` вызывался безусловно на каждый прогон эффекта, заводя
    // зеркало на новую ссылку с теми же значениями — `deferred` на миг отставал от `live`,
    // и `isUpdating` кратко становился `true` даже без единого реального изменения параметров
    // (лишний "Updating…"-флэш на каждом свежем маунте `/search`).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLive(prevLive => {
      const unchanged =
        prevLive.query === query &&
        prevLive.sort === sort &&
        prevLive.page === page &&
        areFiltersEqual(prevLive.filters, filters)

      return unchanged ? prevLive : { query, filters, sort, page }
    })
  }, [query, filters, sort, page])

  const deferred = useDeferredValue(live)

  return {
    deferredQuery: deferred.query,
    deferredFilters: deferred.filters,
    deferredSort: deferred.sort,
    deferredPage: deferred.page,
    isUpdating: live !== deferred,
  }
}
