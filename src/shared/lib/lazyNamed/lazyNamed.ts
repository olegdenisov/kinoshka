import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * `React.lazy()` ожидает модуль с `default`-экспортом; страничные слайсы (`@pages/*`) экспортируют
 * компонент именованно (`export { HomePage } from './HomePage'`), поэтому голый
 * `lazy(() => import(...))` не резолвится. `lazyNamed` достаёт нужный именованный экспорт и
 * оборачивает его в форму, которую понимает `lazy()`.
 *
 * **`exportName: string`, не `keyof М` — осознанный, а не забытый пробел (см. ревью).** Пробовал
 * `K extends Extract<keyof M, string>` с `M extends Record<string, ComponentType<P>>`: ловит
 * опечатку в `exportName` на этапе `tsc`, но ломает реальные вызовы — `Record<string,
 * ComponentType<P>>` требует единый `P` для ВСЕХ ключей модуля, и контравариантность пропсов
 * компонента (`ComponentType<P>` использует `P` в позиции параметра) не даёт `tsc` вывести общий
 * `P`, даже когда модуль экспортирует ровно один компонент — `tsc -b` падает на существующих
 * тестах (`lazyNamed.test.tsx`) с "Property 'name' is missing in type '{}'". Более точная типизация
 * (per-key extraction через conditional types) требует либо `any` где-то внутри (запрещён
 * `.oxlintrc.json`'s `"no-explicit-any": "error"`), либo сильно усложняет сигнатуру ради
 * гипотетической опечатки — не стоит того. Оставлено как принятый минорный гэп: опечатка в
 * `exportName` ловится не `tsc`, а `router.test.tsx`'s smoke-тестами на все 6 роутов (см. Task 2).
 */
export const lazyNamed = <P extends object>(
  factory: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string,
): LazyExoticComponent<ComponentType<P>> =>
  lazy(() => factory().then(module => ({ default: module[exportName] })))
