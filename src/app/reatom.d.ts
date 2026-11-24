import type { ReactElement } from 'react'

// Расширение типа пакета: render роутов возвращает React-элемент. Файл — модуль (import выше),
// иначе `declare module` стал бы объявлением нового модуля и затенил типы @reatom/core.
declare module '@reatom/core' {
  // Declaration merging работает только через interface — второе исключение из правила
  // «type, не interface» (первое — Window в src/vite-env.d.ts).
  // oxlint-disable-next-line typescript/consistent-type-definitions
  interface RouteChild extends ReactElement {}
}
