import {
  addGlobalExtension,
  type Frame,
  ReatomAbortController,
  top,
  withMiddleware,
} from '@reatom/core'

// context.reset() не отменяет асинхронные продолжения: проверка «context reset» в wrap
// сравнивает root кадра с самим собой, а дочерние кадры держат ссылку на старый root. Без
// явной отмены запрос, стартовавший после `await wrap(...)` прошлого теста, уходит уже в
// следующем тесте и падает в onUnhandledRequest: 'error'. Поэтому каждый кадр атома/action,
// вычисленный за тест, запоминается, а в afterEach абортится — wrap и abortVar.subscribe
// проходят цепочку кадров и бросают AbortError.
//
// Модуль импортируется первым в src/test/setup.ts: глобальное расширение применяется только к
// атомам, созданным после регистрации.
const framesOfTest = new Set<Frame>()

addGlobalExtension(
  withMiddleware(() => (next, ...params) => {
    framesOfTest.add(top())
    return next(...params)
  }),
)

export const abortTestFrames = () => {
  for (const frame of framesOfTest) {
    frame['var#abort'] ??= new ReatomAbortController('test.scope')
    frame['var#abort'].abort('test finished')
  }
  framesOfTest.clear()
}
