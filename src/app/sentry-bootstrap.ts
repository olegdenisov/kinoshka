import { initSentry } from './sentry'

// initSentry() должен выполниться ДО ./reatom-setup: там initRouteTracing берёт клиент через
// Sentry.getClient() и стартует pageload-спан. Если reatom-setup выполнится раньше Sentry.init(),
// клиента ещё нет — трейсинг роутов молча не включится до перезагрузки, без ошибки и лога.
// Отдельный модуль, импортируемый первой строкой в main.tsx, — канонический паттерн самого
// Sentry SDK (аналог instrument.js): по семантике ES-модулей статические импорты вычисляются
// полностью до тела импортирующего модуля, так что вызов initSentry() в теле main.tsx опоздал бы.
initSentry()
