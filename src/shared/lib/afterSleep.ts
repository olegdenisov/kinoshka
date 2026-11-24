import { sleep, wrap } from '@reatom/core'

// Отмена контекста (withAbort, перезапуск effect) — штатный исход debounce: отклонение sleep
// гасится здесь, а не уходит вызывающему unhandled rejection.
export const afterSleep = (ms: number, callback: () => void) => {
  wrap(sleep(ms)).then(wrap(callback), () => {})
}
