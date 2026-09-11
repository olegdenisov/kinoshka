// isAnalyticsEnabled не реэкспортируется — единственный потребитель (reportWebVitals.ts)
// импортирует её напрямую из './analytics', чтобы не создавать циклический импорт
// с этим же index.ts (который сам реэкспортирует reportWebVitals).
export { initAnalytics, trackEvent, trackPageview } from './analytics'
export { reportWebVitals } from './reportWebVitals'
