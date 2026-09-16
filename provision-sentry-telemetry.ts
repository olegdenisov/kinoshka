// Эффектный provisioning-скрипт поверх `sentry` CLI — create-if-missing (не полная
// синхронизация, см. Technical Details плана) для error-rate Metric Alert (failure_rate()), LCP
// P75 Metric Alert и дашборда "Kinoshka Telemetry" (+ виджеты, только при первом создании
// дашборда). Чистая логика (пороги/argv-builders) — в sentry-telemetry.config.ts; здесь — только
// сайд-эффекты (execFileSync, process.env, console).
//
// Реальный запуск против прод-Sentry — Post-Completion (см.
// docs/plans/20260915-telemetry-dashboard-sentry-alerts.md, "Явно вне рамок этого плана"), не
// часть Implementation Steps. Юнит-тестами здесь покрыты только validateEnv() (чистая
// env-валидация) — сам main() не запускается в тестах (см. guard в конце файла).
//
// Импорт с явным расширением `.ts` — Node v24's native TS type-stripping требует этого при
// импорте между root .ts-файлами (см. Context плана).
import { execFileSync } from 'node:child_process'

import {
  buildDashboardCreateArgs,
  buildDashboardListArgs,
  buildErrorRateMetricAlertArgs,
  buildLcpMetricAlertArgs,
  buildMetricAlertListArgs,
  buildTeamListArgs,
  buildWidgetArgs,
  DASHBOARD_TITLE,
  DASHBOARD_WIDGETS,
  ERROR_RATE_METRIC_ALERT_CONFIG,
  LCP_METRIC_ALERT_CONFIG,
  shouldCreate,
  type TelemetryContext,
} from './sentry-telemetry.config.ts'

export type ProvisionEnv = {
  SENTRY_ORG?: string
  SENTRY_PROJECT?: string
}

// Fail-fast, понятная ошибка вместо undefined в argv дальше по цепочке (см. Technical Details
// плана — прецедент vercel-headers.test.ts). Принимает env явным параметром (по умолчанию
// process.env) ради тестируемости без мутации глобального process.env.
export const validateEnv = (
  env: ProvisionEnv = process.env,
): { org: string; project: string } => {
  const { SENTRY_ORG: org, SENTRY_PROJECT: project } = env
  if (!org || !project) {
    throw new Error(
      'SENTRY_ORG/SENTRY_PROJECT не заданы. Убедитесь, что .env.local существует и содержит оба ' +
        "значения — Makefile's `sentry-telemetry` цель запускает этот скрипт через " +
        '`node --env-file-if-exists=.env.local`, но пустой/отсутствующий .env.local тихо оставит ' +
        'их undefined.',
    )
  }
  return { org, project }
}

type JsonListResponse<T> = { data: T[] }

const runSentryJson = <T>(args: string[]): JsonListResponse<T> => {
  const raw = execFileSync('sentry', args, { encoding: 'utf-8' })
  return JSON.parse(raw) as JsonListResponse<T>
}

const runSentry = (args: string[]): void => {
  execFileSync('sentry', args, { stdio: 'inherit' })
}

async function main(): Promise<void> {
  const { org, project } = validateEnv()

  // Team резолвится динамически (не хардкодится), чтобы не протухнуть, если команда в Sentry
  // когда-нибудь переименуется/пересоздастся — см. Technical Details плана.
  const teamList = runSentryJson<{ id: string; slug: string }>([
    'team',
    'list',
    ...buildTeamListArgs({ org }),
  ])
  const team = teamList.data[0]
  if (!team) {
    throw new Error(
      `В организации "${org}" не найдено ни одной команды — некому назначить ` +
        'уведомления алертов (targetIdentifier).',
    )
  }
  const ctx: TelemetryContext = { org, project, teamId: team.id }

  const metricAlertList = runSentryJson<{ name: string }>([
    'alert',
    'metrics',
    'list',
    ...buildMetricAlertListArgs(ctx),
  ])
  const existingMetricAlertNames = metricAlertList.data.map(rule => rule.name)

  if (
    shouldCreate(existingMetricAlertNames, ERROR_RATE_METRIC_ALERT_CONFIG.name)
  ) {
    runSentry([
      'alert',
      'metrics',
      'create',
      ...buildErrorRateMetricAlertArgs(ctx),
    ])
  } else {
    console.warn(
      `Metric Alert "${ERROR_RATE_METRIC_ALERT_CONFIG.name}" уже существует — пропуск.`,
    )
  }

  if (shouldCreate(existingMetricAlertNames, LCP_METRIC_ALERT_CONFIG.name)) {
    runSentry(['alert', 'metrics', 'create', ...buildLcpMetricAlertArgs(ctx)])
  } else {
    console.warn(
      `Metric Alert "${LCP_METRIC_ALERT_CONFIG.name}" уже существует — пропуск.`,
    )
  }

  const dashboardList = runSentryJson<{ title: string }>([
    'dashboard',
    'list',
    ...buildDashboardListArgs(ctx),
  ])
  const existingDashboardTitles = dashboardList.data.map(d => d.title)

  if (shouldCreate(existingDashboardTitles, DASHBOARD_TITLE)) {
    runSentry([
      'dashboard',
      'create',
      ...buildDashboardCreateArgs(ctx, DASHBOARD_TITLE),
    ])
    // Виджеты добавляются только при первом создании дашборда — если дашборд уже существовал,
    // скрипт его не трогает вообще (ни создаёт заново, ни диффует виджеты), см. Technical Details
    // плана, "Idempotency".
    for (const widget of DASHBOARD_WIDGETS) {
      runSentry([
        'dashboard',
        'widget',
        'add',
        ...buildWidgetArgs(ctx, DASHBOARD_TITLE, widget),
      ])
    }
  } else {
    console.warn(
      `Дашборд "${DASHBOARD_TITLE}" уже существует — пропуск (виджеты не трогаются).`,
    )
  }
}

// Запускать main() только при прямом запуске файла (`node provision-sentry-telemetry.ts`), не
// при импорте из тестов — иначе `provision-sentry-telemetry.test.ts` реально дёргал бы `sentry`
// CLI при каждом `make test`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error)
    process.exitCode = 1
  })
}
