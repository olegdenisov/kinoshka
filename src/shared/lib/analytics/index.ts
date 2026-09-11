// isAnalyticsEnabled не реэкспортируется — единственный потребитель (reportWebVitals.ts)
// импортирует её напрямую из './analytics'. У неё нет потребителей за пределами
// analytics/, поэтому тянуть её через публичный барел этого index.ts незачем.
export { initAnalytics, trackEvent, trackPageview } from './analytics'
export { reportWebVitals } from './reportWebVitals'
