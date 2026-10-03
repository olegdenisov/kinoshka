import { connectLogger } from '@reatom/core'

// Логгер только в dev: в проде он раздувает консоль и бандл-время инициализации, а в тестах
// засоряет вывод Vitest.
if (import.meta.env.MODE === 'development') {
  connectLogger()
}
