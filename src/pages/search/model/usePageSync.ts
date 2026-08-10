import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'
import {
  stripFilterAndSortParams,
  type FilterState,
} from '@features/catalog-filter'

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

/** `?page` → `1`, если ещё не `1` — иначе возвращает `params` без изменений (no-op). */
const resetPageToOne = (params: URLSearchParams): URLSearchParams => {
  if ((params.get('page') ?? '1') === '1') {
    return params
  }
  const next = new URLSearchParams(params)
  next.set('page', '1')
  return next
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
 *
 * **Deep-link guard (ревью-фаза, найдено после первой реализации).** Эффект ниже реагирует
 * только на *смену* `resetKey` между рендерами — на самом первом рендере `prevResetKeyRef`
 * инициализирован тем же значением, что и текущий `resetKey`, поэтому эффект тела не выполняет.
 * Значит прямой заход по ссылке (или refresh) на `/search?q=foo&genres=Drama&sort=Newest`
 * никогда не проходит через переход `'' → непустой query` — фильтры/сортировка остаются
 * "мёртвыми" в URL с самого начала, тот же симптом, что и баг 2, просто с другим входом
 * (mount вместо ввода в шапке). Отдельный mount-only эффект ниже стрипает их один раз, но
 * ТОЛЬКО если реально есть что стрипать — иначе он трогал бы `?page` на любом легитимном
 * deep-link'е вида `?q=foo&page=8` без единого фильтра (см. тест "устаревший/deep-linked
 * ?page вне диапазона").
 */
export const usePageSync = ({
  query,
  filters,
}: PageSyncParams): PageSyncResult => {
  const [searchParams, setSearchParams] = useSearchParams()

  const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10) || 1
  const page = Math.min(MAX_PAGE, Math.max(1, rawPage))

  const goToPage = (p: number) => {
    const clamped = Math.min(MAX_PAGE, Math.max(1, p))
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev)
        params.set('page', String(clamped))
        return params
      },
      { replace: true },
    )
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const isSearching = query.trim() !== ''

  useEffect(() => {
    if (!isSearching) {
      return
    }

    const stripped = stripFilterAndSortParams(searchParams)
    const hasStaleFilterOrSort = stripped.toString() !== searchParams.toString()
    if (!hasStaleFilterOrSort) {
      return
    }

    setSearchParams(prev => resetPageToOne(stripFilterAndSortParams(prev)), {
      replace: true,
    })
    // Пустой массив зависимостей — намеренно: эффект должен запуститься строго один раз при
    // монтировании (deep-link guard, см. докблок выше); обычные смены query/filters уже
    // покрыты отдельным reset-эффектом ниже через resetKey, повторный прогон здесь не нужен
    // и не должен реагировать на дальнейшие изменения searchParams/setSearchParams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resetKey = `${query.trim()}|${JSON.stringify(filters)}`
  const prevResetKeyRef = useRef(resetKey)
  const wasSearchingRef = useRef(isSearching)

  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) {
      return
    }
    prevResetKeyRef.current = resetKey

    const enteringSearch = isSearching && !wasSearchingRef.current
    wasSearchingRef.current = isSearching

    setSearchParams(
      prev =>
        resetPageToOne(enteringSearch ? stripFilterAndSortParams(prev) : prev),
      { replace: true },
    )
  }, [resetKey, setSearchParams, isSearching])

  return { page, goToPage }
}
