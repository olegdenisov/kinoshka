import { initThemeSync } from '@features/theme'
import { connectLogger } from '@reatom/core'

// Логгер только в dev: в проде он раздувает консоль и бандл-время инициализации, а в тестах
// засоряет вывод Vitest.
if (import.meta.env.MODE === 'development') {
  connectLogger()
}

// Синхронизация data-theme с resolvedTheme; inline-скрипт в index.html ставит тему до гидрации,
// это подхватывает смену после.
initThemeSync()
