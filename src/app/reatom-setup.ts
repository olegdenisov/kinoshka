import { initThemeSync } from '@features/theme'
import { connectLogger } from '@reatom/core'

import { initRouteTracing } from './model/routeTracing'
import { initScrollRestoration } from './model/scrollRestoration'

// Логгер только в dev: в проде он раздувает консоль и бандл-время инициализации, а в тестах
// засоряет вывод Vitest.
if (import.meta.env.MODE === 'development') {
  connectLogger()
}

// Синхронизация data-theme с resolvedTheme; inline-скрипт в index.html ставит тему до гидрации,
// это подхватывает смену после.
initThemeSync()

// Замена <ScrollRestoration /> React Router: сброс скролла при переходе и восстановление на back/forward.
initScrollRestoration()

// Спаны pageload/navigation с именем по шаблону роута; требует уже выполненного Sentry.init()
// (sentry-bootstrap — первый импорт main.tsx).
initRouteTracing()
