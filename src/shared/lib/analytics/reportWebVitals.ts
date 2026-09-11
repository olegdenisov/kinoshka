import type { Metric } from 'web-vitals'

import { isAnalyticsEnabled, trackEvent } from './analytics'

// Имя события в нижнем регистре (`web vital: lcp`) — единообразно с 'search submitted'/
// 'filter changed'/'favorite added' (см. Solution Overview плана). CLS домножается на 1000 —
// сырое значение унитless-дробь вроде 0.05, *1000 даёт целое число, удобное как prop Plausible.
const reportMetric = (metric: Metric): void => {
  trackEvent(`web vital: ${metric.name.toLowerCase()}`, {
    value: Math.round(
      metric.name === 'CLS' ? metric.value * 1000 : metric.value,
    ),
    rating: metric.rating,
  })
}

// Модульный флаг, симметричный initAnalytics()'s getElementById-гейту — защита от повторной
// регистрации callback'ов при повторном вызове/HMR.
let reported = false

// Явная функция, вызываемая один раз из providers.tsx (Task 4), не side-effect при импорте —
// тестируема через vi.stubEnv, тот же паттерн, что initSentry/initAnalytics.
export const reportWebVitals = (): void => {
  if (!isAnalyticsEnabled()) return
  if (reported) return
  reported = true

  // Динамический импорт, не статический `import ... from 'web-vitals'` вверху файла:
  // analytics/index.ts реэкспортируется через публичный барел src/shared/lib/index.ts,
  // который тянется почти из всех модулей приложения — статический импорт затащил бы
  // web-vitals в основной чанк ради одной прод-only точки вызова.
  //
  // Обработчик ошибки обязателен: сетевой сбой (offline, ad-blocker, упавший CDN) роняет сам
  // import() с unhandled promise rejection, если её не перехватить. `reported` откатывается
  // назад, чтобы повторный вызов reportWebVitals() (например, HMR) не был заблокирован навсегда
  // из-за одной неудачной попытки загрузки чанка.
  //
  // Двухаргументная форма .then(onFulfilled, onRejected) вместо .then(onFulfilled).catch(...) —
  // намеренно: onRejected здесь реагирует только на отказ самого import(), а не на ошибку внутри
  // onFulfilled. Если сама регистрация onLCP/onINP/onCLS вдруг бросит исключение, это другая
  // категория сбоя (не "не удалось загрузить чанк"), и списывать её на 'failed to load' было бы
  // вводящим в заблуждение логом.
  void import('web-vitals').then(
    ({ onLCP, onINP, onCLS }) => {
      onLCP(reportMetric)
      onINP(reportMetric)
      onCLS(reportMetric)
    },
    (error: unknown) => {
      reported = false
      console.error('[web-vitals] failed to load', error)
    },
  )
}
