// Внутренняя деталь модуля — не реэкспортируется из публичного src/shared/lib/index.ts
// (см. index.ts в этой же директории). Единая точка "выключена ли аналитика целиком",
// симметрично initSentry (src/app/sentry.ts).
export const isAnalyticsEnabled = (): boolean =>
  import.meta.env.PROD && Boolean(import.meta.env.VITE_PLAUSIBLE_DOMAIN)

const SCRIPT_ID = 'plausible-analytics-script'

// Явная функция, а не side-effect при импорте — тестируема с разными import.meta.env.PROD /
// VITE_PLAUSIBLE_DOMAIN через vi.stubEnv (тот же паттерн, что initSentry).
export const initAnalytics = (): void => {
  if (!isAnalyticsEnabled()) return

  // Критично: стаб ставится СИНХРОННО, до вставки <script> в DOM. Динамически вставленный
  // <script> исполняется асинхронно независимо от defer, поэтому без стаба window.plausible
  // не определена ещё несколько миллисекунд после initAnalytics() — trackPageview() из
  // AppLayout's mount-эффекта и ранние web-vitals (LCP) терялись бы почти на каждой сессии.
  // Официальный стаб Plausible для script.manual.js: копит вызовы в window.plausible.q,
  // сам скрипт при загрузке доотправляет их.
  window.plausible =
    window.plausible ||
    (function (...args: unknown[]) {
      ;(window.plausible!.q = window.plausible!.q || []).push(args)
    } as Window['plausible'])

  // Защита от повторного вызова (напр. HMR) — не вставлять второй <script>.
  if (document.getElementById(SCRIPT_ID)) return

  const script = document.createElement('script')
  script.id = SCRIPT_ID
  script.defer = true
  script.dataset.domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN
  script.src = 'https://plausible.io/js/script.manual.js'
  document.head.appendChild(script)
}

export const trackEvent = (
  name: string,
  props?: Record<string, string | number | boolean>,
): void => {
  if (!isAnalyticsEnabled()) return
  window.plausible?.(name, props ? { props } : undefined)
}

// 'pageview' — зарезервированное имя события в Plausible (не custom event), вызывает
// реальную запись просмотра страницы. .manual.js-вариант скрипта отключает автотрекинг,
// поэтому вызывается явно на каждую смену роута (SPA-паттерн для Plausible).
export const trackPageview = (): void => trackEvent('pageview')
