import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { stripFilterAndSortParams, type FilterState } from '@features/catalog-filter'

/** Demo-тариф: страницы 1–10 (клэмп и на чтении из URL, и на записи через goToPage). */
const MAX_PAGE = 10

export type PageSyncParams = {
  query: string
  filters: FilterState
}

export type PageSyncResult = {
  page: number
  goToPage: (p: number) => void
}

/**
 * Общая для `SearchDesktop`/`SearchMobile` логика чтения/записи `?page` (Task 11/12;
 * вынесена ревью-фазой 2 — ранее была продублирована почти дословно между обоими компонентами
 * и уже расходилась один раз). Клэмп к demo-потолку `[1, MAX_PAGE]` и на чтении, и на записи;
 * смена `query`/`filters` сбрасывает `?page` на 1 — старый `?page` из предыдущей выдачи не
 * имеет смысла для новой. Сравнение через ref внутри эффекта (не источник истины — им
 * остаётся URL), запускается только при реальной смене `query`/`filters`, не на каждый рендер.
 *
 * При переходе `'' → непустой query` (пользователь начал текстовый поиск из шапки) фильтры/сортировка
 * теряют смысл (см. AGENTS.md, "Variant A" — API не сочетает текстовый поиск с фильтрами), поэтому
 * тот же эффект зачищает их через `stripFilterAndSortParams`. Это сделано ОДНИМ вызовом
 * `setSearchParams` вместе со сбросом `?page`, а не отдельным эффектом: функциональный апдейтер
 * `setSearchParams` замыкается на render-снэпшот `searchParams`, и если сброс `page` и зачистка
 * фильтров идут двумя независимыми эффектами, реагирующими на один и тот же URL-переход, второй
 * вызов молча перезатрёт результат первого (реальная гонка, не гипотетическая — см. Context в
 * плане `docs/plans/20260806-search-loading-indicator-and-filter-reset.md`).
 */
export const usePageSync = ({ query, filters }: PageSyncParams): PageSyncResult => {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1
  const page = Math.min(MAX_PAGE, Math.max(1, rawPage))

  const goToPage = (p: number) => {
    const clamped = Math.min(MAX_PAGE, Math.max(1, p))
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set('page', String(clamped))
        return params
      },
      { replace: true },
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const resetKey = `${query.trim()}|${JSON.stringify(filters)}`
  const prevResetKeyRef = useRef(resetKey)
  const wasSearchingRef = useRef(query.trim() !== '')

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) {
      return
    }
    prevResetKeyRef.current = resetKey

    const isSearching = query.trim() !== ''
    const enteringSearch = isSearching && !wasSearchingRef.current
    wasSearchingRef.current = isSearching

    setSearchParams(
      (prev) => {
        const base = enteringSearch ? stripFilterAndSortParams(prev) : prev
        if ((base.get('page') ?? '1') === '1') {
          return base
        }
        const params = new URLSearchParams(base)
        params.set('page', '1')
        return params
      },
      { replace: true },
    )
  }, [resetKey, setSearchParams, query])

  return { page, goToPage }
}
