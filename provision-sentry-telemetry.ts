// Эффектный provisioning-скрипт поверх `sentry` CLI — create-if-missing (не полная
// синхронизация, см. Technical Details плана) для error-rate Metric Alert (failure_rate()), LCP
// P75 Metric Alert и дашборда "Kinoshka Telemetry" (+ виджеты, только при первом создании
// дашборда). Чистая логика (пороги/argv-builders) — в sentry-telemetry.config.ts; здесь — только
// сайд-эффекты (execFileSync, process.env, console).
//
// Реальный запуск против прод-Sentry — Post-Completion (см.
// docs/plans/20260915-telemetry-dashboard-sentry-alerts.md, "Явно вне рамок этого плана"), не
// часть Implementation Steps.
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

// [review phase 1] Раньше runSentryJson/runSentry были module-private функциями, жёстко
// завязанными на execFileSync — main() была из-за этого нетестируемой без мокания
// `node:child_process` целиком (что на практике оказалось ненадёжным: живая попытка замокать
// node:child_process через vi.mock реально достучалась до настоящего `sentry` CLI на этой машине,
// см. прогресс-файл задачи, "review phase 1" — тесты ниже используют DI вместо этого). SentryRunner
// — минимальный интерфейс двух эффектных операций (JSON-читающий list-вызов и side-effect-вызов
// create/widget add), main() принимает его явным параметром с дефолтом на реальный execFileSync —
// тот же приём, что validateEnv()'s `env` параметр (по умолчанию process.env, инъекция для
// тестов).
export type SentryRunner = {
  json: <T>(args: string[]) => JsonListResponse<T>
  run: (args: string[]) => void
}

const defaultRunner: SentryRunner = {
  json: <T>(args: string[]) => {
    const raw = execFileSync('sentry', args, { encoding: 'utf-8' })
    return JSON.parse(raw) as JsonListResponse<T>
  },
  run: args => {
    execFileSync('sentry', args, { stdio: 'inherit' })
  },
}

export async function main(
  runner: SentryRunner = defaultRunner,
): Promise<void> {
  const { org, project } = validateEnv()

  // Team резолвится динамически (не хардкодится), чтобы не протухнуть, если команда в Sentry
  // когда-нибудь переименуется/пересоздастся — см. Technical Details плана.
  const teamList = runner.json<{ id: string; slug: string }>([
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

  const metricAlertList = runner.json<{ name: string }>([
    'alert',
    'metrics',
    'list',
    ...buildMetricAlertListArgs(ctx),
  ])
  const existingMetricAlertNames = metricAlertList.data.map(rule => rule.name)

  if (
    shouldCreate(existingMetricAlertNames, ERROR_RATE_METRIC_ALERT_CONFIG.name)
  ) {
    runner.run([
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
    runner.run(['alert', 'metrics', 'create', ...buildLcpMetricAlertArgs(ctx)])
  } else {
    console.warn(
      `Metric Alert "${LCP_METRIC_ALERT_CONFIG.name}" уже существует — пропуск.`,
    )
  }

  const dashboardList = runner.json<{ title: string }>([
    'dashboard',
    'list',
    ...buildDashboardListArgs(ctx),
  ])
  const existingDashboardTitles = dashboardList.data.map(d => d.title)

  if (shouldCreate(existingDashboardTitles, DASHBOARD_TITLE)) {
    runner.run([
      'dashboard',
      'create',
      ...buildDashboardCreateArgs(ctx, DASHBOARD_TITLE),
    ])
    // [review phase 1, iteration 2] Виджеты добавляются только при первом создании дашборда — если
    // дашборд уже существовал, скрипт его не трогает вообще (ни создаёт заново, ни диффует
    // виджеты), см. Technical Details плана, "Idempotency". Это создаёт ловушку при частичном
    // сбое: если один из `widget add`-вызовов упадёт (реальная сетевая/CLI-ошибка), дашборд уже
    // создан, а shouldCreate() на следующем запуске увидит его по имени и молча пропустит ВЕСЬ
    // цикл виджетов навсегда — без ретрая/резюме (CLI не даёт `dashboard widget list`, чтобы можно
    // было продиффить, что уже добавлено, не городя полноценную reconciliation-логику ради
    // одноразового provisioning-скрипта). Минимальный фикс, соразмерный масштабу: не глотать
    // ошибку молча — перехватить, обогатить понятным списком недобавленных виджетов и явной
    // инструкцией по ручному восстановлению, и перебросить дальше (main().catch ниже всё равно
    // выставит process.exitCode = 1 и залогирует).
    for (const [index, widget] of DASHBOARD_WIDGETS.entries()) {
      try {
        runner.run([
          'dashboard',
          'widget',
          'add',
          ...buildWidgetArgs(ctx, DASHBOARD_TITLE, widget),
        ])
      } catch (error) {
        const remainingWidgetNames = DASHBOARD_WIDGETS.slice(index + 1).map(
          w => w.name,
        )
        throw new Error(
          `Дашборд "${DASHBOARD_TITLE}" уже создан, но добавление виджета ` +
            `"${widget.name}" (${index + 1}/${DASHBOARD_WIDGETS.length}) упало: ` +
            `${error instanceof Error ? error.message : String(error)}. Повторный запуск ` +
            'скрипта НЕ повторит эту попытку — дашборд уже существует по имени, поэтому ' +
            'shouldCreate() молча пропустит весь блок виджетов на следующем запуске. ' +
            (remainingWidgetNames.length > 0
              ? `Недобавленные виджеты: ${remainingWidgetNames.join(', ')}. `
              : '') +
            'Восстановление вручную: либо добавьте оставшиеся виджеты напрямую через ' +
            '`sentry dashboard widget add`, либо удалите дашборд ' +
            `"${DASHBOARD_TITLE}" в Sentry UI и перезапустите \`make sentry-telemetry\`, ` +
            'чтобы пересоздать его с нуля.',
          { cause: error },
        )
      }
    }
  } else {
    console.warn(
      `Дашборд "${DASHBOARD_TITLE}" уже существует — пропуск (виджеты не трогаются; если ` +
        'предыдущий запуск упал посреди цикла виджетов, часть из них может отсутствовать — ' +
        'см. WHY-комментарий у цикла добавления виджетов выше для ручного восстановления).',
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
