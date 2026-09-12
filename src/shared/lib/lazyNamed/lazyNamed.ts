import { lazy } from 'react'
import type { ComponentType, LazyExoticComponent } from 'react'

/**
 * `React.lazy()` ожидает модуль с `default`-экспортом; страничные слайсы (`@pages/*`) экспортируют
 * компонент именованно (`export { HomePage } from './HomePage'`), поэтому голый
 * `lazy(() => import(...))` не резолвится. `lazyNamed` достаёт нужный именованный экспорт и
 * оборачивает его в форму, которую понимает `lazy()`.
 */
export const lazyNamed = <P extends object>(
  factory: () => Promise<Record<string, ComponentType<P>>>,
  exportName: string,
): LazyExoticComponent<ComponentType<P>> =>
  lazy(() => factory().then(module => ({ default: module[exportName] })))
