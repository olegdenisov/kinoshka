import { captureChunkLoadError } from './sentry'

// Vite диспатчит window-событие 'vite:preloadError' при сбое динамического import() чанка
// (устаревший деплой/chunk 404/сетевая ошибка) — ДО того, как та же ошибка дойдёт до
// Suspense/ErrorBoundary как rejected promise (https://vite.dev/guide/build.html#load-error-handling).
// React.lazy кэширует rejected-промис на модуль — ни retry в ErrorState, ни навигация на другой
// роут (в т.ч. на '/', если упавший чанк общий — shared/page-home) не гарантируют восстановление
// (см. план 20260916-per-route-error-boundaries.md, Overview, решение №2). Полная перезагрузка
// страницы — единственный действительно надёжный путь: чистый module cache, свежий index.html со
// ссылками на актуальные чанки.
//
// Защита от цикла: если чанк не грузится стабильно (битый деплой, ad-blocker, прокси, CSP), reload
// повторял бы тот же сбой бесконечно. Перед reload пишем метку Date.now() в sessionStorage
// (переживает reload в той же вкладке). Документ считается «recovery-документом», если он стартовал
// (performance.timeOrigin) < RELOAD_GUARD_MS после метки — reload() → timeOrigin это лишь unload
// старой страницы; отрицательная разница — тоже он. Сравниваем со стартом документа, а не с
// моментом сбоя: медленный чанк (висящий запрос, 3G) падает через десятки секунд после reload.
// Но guard действует только первые RECOVERY_DOC_WINDOW_MS жизни документа (performance.now(),
// с запасом больше сетевого таймаута): иначе долгоживущая SPA-вкладка, стартовавшая recovery-reload,
// уже никогда не восстановилась бы на следующем устаревшем деплое через час.
// Матрица (на каждую строку — тест):
//  1. первый сбой на обычной странице → preventDefault, один репорт, один reload;
//  2. пачка событий одного сбоя (CSS + JS) → все preventDefault, один репорт и один reload (isReloading);
//  3. recovery-документ, быстрый сбой → без reload, ошибку показывает per-route ErrorBoundary;
//  4. recovery-документ, медленный сбой (30s, в окне документа) → без reload;
//  5. recovery-документ, новый сбой спустя час (следующий деплой) → reload снова разрешён;
//  6. ручной reload / новая загрузка сильно позже метки → reload разрешён;
//  7. sessionStorage не пишется → без reload (без метки guard не сработает — лучше ошибка, чем цикл);
//  8. dev → обработчик ничего не делает;
//  9. повторная регистрация → один слушатель.
// sessionStorage напрямую, а не createStorageSlot (тот только для localStorage) — метка нужна одной
// вкладке и одной сессии.
const RELOAD_GUARD_KEY = 'kinoshka:chunk-reload-at'
const RELOAD_GUARD_MS = 10_000
const RECOVERY_DOC_WINDOW_MS = 120_000

// Идемпотентность: повторный вызов не должен вешать второй слушатель (иначе два reload() и два
// события в Sentry на один сбой) — актуально и для тестов, где window живёт на весь файл.
let isRegistered = false

// В типичном сбое устаревшего деплоя падает не один чанк, а несколько (CSS 404 + JS 404) —
// Vite диспатчит по 'vite:preloadError' на каждый, миллисекунды друг за другом, ДО того, как
// location.reload() успевает выгрузить документ (reload() не останавливает синхронный JS).
// sessionStorage-метка тут не помощник — она отличает только повторный сбой ПОСЛЕ настоящего
// reload от сбоя в текущей загрузке страницы, а не второе событие внутри одной и той же пачки.
// Поэтому отдельный in-memory флаг: как только reload запущен, гасим все дальнейшие события этой
// же загрузки страницы без повторного captureChunkLoadError/reload. Настоящий reload() обнулит
// его сам — весь модуль пересоздаётся с нуля на свежей странице.
let isReloading = false

const readLastReloadAt = (): number | null => {
  try {
    const raw = sessionStorage.getItem(RELOAD_GUARD_KEY)
    return raw === null ? null : Number(raw)
  } catch {
    return null
  }
}

const writeReloadAt = (timestamp: number): boolean => {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(timestamp))
    return true
  } catch {
    return false
  }
}

const handlePreloadError = (event: Event & { payload?: unknown }): void => {
  // В dev (HMR, отсутствующая CSS-зависимость) reload спрятал бы ошибку — пусть всплывает как есть.
  if (!import.meta.env.PROD) return

  // Вторая (и любая следующая) ошибка из той же пачки сбоев одной загрузки страницы — reload уже
  // запущен, просто гасим её, без повторного репорта в Sentry.
  if (isReloading) {
    event.preventDefault()
    return
  }

  const lastReloadAt = readLastReloadAt()
  if (
    lastReloadAt !== null &&
    performance.timeOrigin - lastReloadAt < RELOAD_GUARD_MS &&
    performance.now() < RECOVERY_DOC_WINDOW_MS
  )
    return
  // Без записанной метки guard не сработает после reload — лучше показать ошибку, чем зациклиться.
  if (!writeReloadAt(Date.now())) return

  isReloading = true
  event.preventDefault()
  captureChunkLoadError(event.payload)
  window.location.reload()
}

export const registerChunkPreloadRecovery = (): void => {
  if (isRegistered) return
  isRegistered = true
  window.addEventListener('vite:preloadError', handlePreloadError)
}
