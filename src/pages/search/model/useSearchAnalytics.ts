import { trackEvent, useDebouncedValue } from '@shared/lib'
import { useEffect, useRef } from 'react'

/**
 * Task 6 (`docs/plans/20260910-web-vitals-analytics.md`) — трекает `'search submitted'` по
 * `query`, приходящему из `Search.tsx` (`searchParams.get('q')`). Этот `query` уже
 * debounce-committed `Header`ом, но собственным дебаунсом `Header`а всего в `QUERY_DEBOUNCE_MS`
 * (250мс) — печатая одно слово, пользователь коммитит в `?q` несколько промежуточных непустых
 * значений подряд ("ba" → "batm" → "batman"), каждое из которых голый transition-ref затрекал бы
 * как отдельный "submit". Поэтому здесь `query` сначала прогоняется через собственный, более
 * долгий `useDebouncedValue` (800мс) — гасит серию быстрых промежуточных коммитов `?q` в одно
 * "устоявшееся" значение — и только затем сравнивается с последним затреканным через `useRef`
 * (тот же transition-ref паттерн, что и `usePageSync.ts`).
 *
 * Событие отправляется без `props` (сам текст запроса не передаётся) — минимизирует объём
 * пользовательских данных в аналитике, соответствует выбору Plausible как privacy-first решения.
 *
 * Page-slice `model/`-хук (не `@features`/`@entities`) — page-internal, не экспортируется через
 * публичный `index.ts` (см. AGENTS.md, "Page-slice `model/` facade").
 */
export const useSearchAnalytics = (query: string): void => {
  const settledQuery = useDebouncedValue(query, 800)
  const lastTrackedRef = useRef<string>('')

  useEffect(() => {
    const trimmed = settledQuery.trim()
    if (trimmed && trimmed !== lastTrackedRef.current) {
      trackEvent('search submitted')
      lastTrackedRef.current = trimmed
    } else if (!trimmed) {
      // Сброс рефа на пустой query — иначе повторный ввод того же текста после очистки поля
      // не затрекается снова.
      lastTrackedRef.current = ''
    }
  }, [settledQuery])
}
