// Чистые вычисления, вынесенные из vite.config.ts ради юнит-тестируемости — сам callback
// defineConfig(({ mode, command }) => {...}) неудобно тестировать напрямую (нужен Vite-контекст),
// а инвертированное условие/потерянный `&&` здесь могло бы молча запаблишить `.map`-файлы (и
// заинлайненный VITE_API_KEY) в dist/, либо молча отключить аплоад sourcemaps в Sentry — ни то,
// ни другое не поймает make test/CI без этого модуля. См.
// docs/plans/20260905-sentry-error-tracking.md, Solution Overview.

export type ReleaseInput = {
  version: string
  gitSha: string
}

// Ровно эта строка идёт и в Sentry.init({ release }) (через define __APP_RELEASE__ в
// vite.config.ts), и в sentryVitePlugin({ release: { name } }) — иначе SDK и аплоад sourcemaps
// тегируют разные releases в Sentry.
export const buildRelease = ({ version, gitSha }: ReleaseInput): string =>
  `kinoshka@${version}+${gitSha}`

export type SentryEnv = {
  SENTRY_AUTH_TOKEN?: string
  SENTRY_ORG?: string
  SENTRY_PROJECT?: string
}

export type SentryEnabledInput = {
  command: 'build' | 'serve'
  env: SentryEnv
}

// sentry-vite-plugin подключается только при билде (не на `vite dev`/Vitest — иначе плагин
// цеплялся бы за них, как только в .env.local появятся настоящие креды) и только когда заданы
// все три креда.
export const isSentryEnabled = ({
  command,
  env,
}: SentryEnabledInput): boolean =>
  command === 'build' &&
  Boolean(env.SENTRY_AUTH_TOKEN && env.SENTRY_ORG && env.SENTRY_PROJECT)

// 'hidden' пишет .map, но без `//# sourceMappingURL=` комментария в чанке — именно
// filesToDeleteAfterUpload на плагине зачищает файлы из dist/ уже после аплоада. `false`, когда
// плагин не подключён (напр. плейсхолдеры в .env.local), иначе .map осел бы в dist/ без того,
// кто их вообще подчистит.
export const resolveBuildSourcemap = (
  sentryEnabled: boolean,
): 'hidden' | false => (sentryEnabled ? 'hidden' : false)

// 0.2 — верхняя граница диапазона 0.1–0.2, рассмотренного ещё в 2.5.1. Компромисс, а не чистая
// экономия квоты: слишком низкий rate экономит транзакционную квоту Sentry на обычном трафике,
// но рискует не набрать сэмплов для надёжного P75/failure_rate() в окне алерта (портфолио-проект,
// низкий трафик) — при очень низком трафике оба соображения могут не сойтись одновременно, это
// принятый риск (см. docs/plans/20260915-telemetry-dashboard-sentry-alerts.md, Post-Completion).
export const SENTRY_TRACES_SAMPLE_RATE = 0.2
