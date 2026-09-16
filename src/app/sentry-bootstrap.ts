import { initSentry } from './sentry'

// initSentry() должен выполниться ДО того, как router.tsx создаст роутер через
// createBrowserRouter(...) — иначе Sentry.wrapCreateBrowserRouter (Task 2b) тихо не оборачивает
// ничего: node_modules/@sentry/react/build/esm/reactrouter-compat-utils/instrumentation.js
// (createV6CompatibleWrapCreateBrowserRouter) при незаданных приватных _useEffect/_useLocation/
// _useNavigationType/_matchRoutes (выставляются в setup(client) интеграции внутри Sentry.init)
// молча возвращает необёрнутую createRouterFunction — предупреждение об этом спрятано за
// DEBUG_BUILD и вырезается в проде, так что баг реальный, но не заметный ни по ошибке, ни по логу.
// Раньше providers.tsx импортировал router из ./router до вызова initSentry() в своём теле
// модуля — по семантике ES-модулей статические импорты вычисляются полностью до тела импортирующего
// модуля, так что router.tsx (и его createBrowserRouter(...)) уже успевал выполниться раньше.
// Вынос initSentry() в отдельный модуль, импортируемый первой строкой в main.tsx (раньше
// import { Providers } из './app/providers', который и импортирует router.tsx), гарантирует
// правильный порядок — это канонический паттерн самого Sentry SDK (аналог instrument.js).
initSentry()
