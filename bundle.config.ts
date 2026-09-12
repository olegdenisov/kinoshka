// Чистые вычисления для визуализации/бюджетирования бандла, вынесенные из vite.config.ts ради
// юнит-тестируемости — тот же приём, что в sentry.config.ts (см. AGENTS.md, раздел "Sentry": "не
// конфиг без тестов, а чистая логика вынесена в отдельный модуль ради тестов"). Отдельный от
// sentry.config.ts файл, чтобы не мешать Sentry-специфичную логику с bundle-специфичной — см.
// docs/plans/20260912-performance-budgets-bundle-visualization.md, Task 4/Technical Details.

export type AnalyzeEnv = {
  ANALYZE?: string
}

export type AnalyzeEnabledInput = {
  command: 'build' | 'serve'
  env: AnalyzeEnv
}

// rollup-plugin-visualizer подключается только по явному флагу ANALYZE=true (не на каждом
// билде/в CI) и только при билде (never на `vite dev`/Vitest) — тот же shape, что
// isSentryEnabled в sentry.config.ts.
export const isAnalyzeEnabled = ({
  command,
  env,
}: AnalyzeEnabledInput): boolean =>
  command === 'build' && env.ANALYZE === 'true'
