import { devtools } from 'zustand/middleware'

// devtools только в DEV: `enabled` не вырезает middleware из прод-сборки, а ветка по
// import.meta.env.DEV — вырезает вместе с middleware. Тип инициализатора не меняется.
export const withDevtools = <TInitializer>(
  name: string,
  initializer: TInitializer,
): TInitializer =>
  import.meta.env.DEV
    ? (devtools(initializer as never, { name }) as unknown as TInitializer)
    : initializer
