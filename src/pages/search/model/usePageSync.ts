import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import type { FilterState } from '@features/catalog-filter'

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

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) {
      return
    }
    prevResetKeyRef.current = resetKey

    setSearchParams(
      (prev) => {
        if ((prev.get('page') ?? '1') === '1') {
          return prev
        }
        const params = new URLSearchParams(prev)
        params.set('page', '1')
        return params
      },
      { replace: true },
    )
  }, [resetKey, setSearchParams])

  return { page, goToPage }
}
