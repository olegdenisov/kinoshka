// Vite диспатчит window-событие 'vite:preloadError' при сбое динамического import() чанка
// (устаревший деплой/chunk 404/сетевая ошибка) — ДО того, как та же ошибка дойдёт до
// Suspense/ErrorBoundary как rejected promise (https://vite.dev/guide/build.html#load-error-handling).
// React.lazy кэширует rejected-промис на модуль — ни retry в ErrorState, ни навигация на другой
// роут (в т.ч. на '/', если упавший чанк общий — shared/page-home) не гарантируют восстановление
// (см. план 20260916-per-route-error-boundaries.md, Overview, решение №2). Полная перезагрузка
// страницы — единственный действительно надёжный путь: чистый module cache, свежий index.html со
// ссылками на актуальные чанки.
export const registerChunkPreloadRecovery = (): void => {
  window.addEventListener('vite:preloadError', event => {
    event.preventDefault()
    window.location.reload()
  })
}
