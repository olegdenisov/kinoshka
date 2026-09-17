import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  main,
  validateEnv,
  type SentryRunner,
} from './provision-sentry-telemetry.ts'
import {
  DASHBOARD_TITLE,
  DASHBOARD_WIDGETS,
} from './sentry-telemetry.config.ts'

// main() исторически не тестировался (см. review phase 1: "только validateEnv() покрыта тестами,
// team-not-found/shouldCreate-гейтинг/list-response извлечение полей/цикл виджетов — нет"). Первая
// попытка исправить это через `vi.mock('node:child_process', ...)` реально достучалась до
// настоящего `sentry` CLI на машине разработчика (authenticated живой аккаунт из Task 3) — мокание
// built-in модуля оказалось ненадёжным в этой связке Vitest/Node-native-TS-исполнения. Вместо
// этого main() теперь принимает `SentryRunner` DI-параметром (см. provision-sentry-telemetry.ts) —
// тесты передают детерминированный fake-runner напрямую, без единого реального subprocess-вызова.
type ListFixtures = {
  team?: Array<{ id: string; slug: string }>
  metricAlerts?: Array<{ name: string }>
  dashboards?: Array<{ title: string }>
}

const createFakeRunner = (fixtures: ListFixtures = {}) => {
  const {
    team = [{ id: '4512052151975936', slug: 'mycomp' }],
    metricAlerts = [],
    dashboards = [],
  } = fixtures

  const runCalls: string[][] = []

  const runner: SentryRunner = {
    json: <T>(args: string[]) => {
      if (args[0] === 'team' && args[1] === 'list') {
        return { data: team } as { data: T[] }
      }
      if (args[0] === 'alert' && args[1] === 'metrics' && args[2] === 'list') {
        return { data: metricAlerts } as { data: T[] }
      }
      if (args[0] === 'dashboard' && args[1] === 'list') {
        return { data: dashboards } as { data: T[] }
      }
      throw new Error(`unexpected runner.json call: ${args.join(' ')}`)
    },
    run: args => {
      runCalls.push(args)
    },
  }

  return { runner, runCalls }
}

const callsMatching = (
  runCalls: string[][],
  predicate: (args: string[]) => boolean,
) => runCalls.filter(predicate)

beforeEach(() => {
  vi.stubEnv('SENTRY_ORG', 'mycomp-ey')
  vi.stubEnv('SENTRY_PROJECT', 'kinoshka')
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('validateEnv', () => {
  it('возвращает { org, project }, когда оба заданы', () => {
    expect(
      validateEnv({ SENTRY_ORG: 'mycomp-ey', SENTRY_PROJECT: 'kinoshka' }),
    ).toEqual({ org: 'mycomp-ey', project: 'kinoshka' })
  })

  it('бросает понятную ошибку, если SENTRY_ORG не задан', () => {
    expect(() => validateEnv({ SENTRY_PROJECT: 'kinoshka' })).toThrow(
      /SENTRY_ORG\/SENTRY_PROJECT не заданы/,
    )
  })

  it('бросает понятную ошибку, если SENTRY_PROJECT не задан', () => {
    expect(() => validateEnv({ SENTRY_ORG: 'mycomp-ey' })).toThrow(
      /SENTRY_ORG\/SENTRY_PROJECT не заданы/,
    )
  })

  it('бросает понятную ошибку, если оба не заданы (edge case — пустой env)', () => {
    expect(() => validateEnv({})).toThrow(
      /SENTRY_ORG\/SENTRY_PROJECT не заданы/,
    )
  })

  // [review phase 1] Каждый предыдущий тест передавал явный env-объект — сам дефолтный параметр
  // (`env: ProvisionEnv = process.env`) ни разу не исполнялся ни одним тестом.
  it('без аргумента читает process.env напрямую (дефолтный параметр)', () => {
    expect(validateEnv()).toEqual({ org: 'mycomp-ey', project: 'kinoshka' })
  })
})

// [review phase 1] main() была полностью непокрыта юнит-тестами — только validateEnv(). Ниже —
// team-not-found ветка, shouldCreate-гейтинг (skip при существующих объектах), извлечение полей
// из list-ответов (team.id/rule.name/d.title, проверяется косвенно через корректный ctx/аргументы
// дальнейших вызовов) и цикл создания виджетов дашборда.
describe('main', () => {
  it('бросает понятную ошибку, если в организации нет ни одной команды', async () => {
    const { runner, runCalls } = createFakeRunner({ team: [] })

    await expect(main(runner)).rejects.toThrow(/не найдено ни одной команды/)

    // Ничего, кроме team list (которая не идёт через runner.run), не должно было быть вызвано —
    // резолвинг team падает раньше любых create-вызовов для алертов/дашборда.
    expect(runCalls).toHaveLength(0)
  })

  it('пропускает create для уже существующих Metric Alert и дашборда (shouldCreate-гейтинг)', async () => {
    const { runner, runCalls } = createFakeRunner({
      metricAlerts: [
        { name: 'Kinoshka: error rate (failure_rate) above threshold' },
        { name: 'Kinoshka: LCP P75 above threshold' },
      ],
      dashboards: [{ title: DASHBOARD_TITLE }],
    })

    await main(runner)

    expect(
      callsMatching(
        runCalls,
        a => a[0] === 'alert' && a[1] === 'metrics' && a[2] === 'create',
      ),
    ).toHaveLength(0)
    expect(
      callsMatching(runCalls, a => a[0] === 'dashboard' && a[1] === 'create'),
    ).toHaveLength(0)
    // Дашборд уже существовал — виджеты не трогаются вообще (см. Technical Details плана,
    // "Idempotency").
    expect(
      callsMatching(runCalls, a => a[0] === 'dashboard' && a[1] === 'widget'),
    ).toHaveLength(0)
  })

  it('создаёт оба Metric Alert и дашборд+виджеты, когда ничего ещё не существует', async () => {
    const { runner, runCalls } = createFakeRunner()

    await main(runner)

    const metricAlertCreateCalls = callsMatching(
      runCalls,
      a => a[0] === 'alert' && a[1] === 'metrics' && a[2] === 'create',
    )
    expect(metricAlertCreateCalls).toHaveLength(2)

    const dashboardCreateCalls = callsMatching(
      runCalls,
      a => a[0] === 'dashboard' && a[1] === 'create',
    )
    expect(dashboardCreateCalls).toHaveLength(1)
    // dashboard create args builder — "<org>/<project>" + title, см. buildDashboardCreateArgs.
    expect(dashboardCreateCalls[0]).toEqual([
      'dashboard',
      'create',
      'mycomp-ey/kinoshka',
      DASHBOARD_TITLE,
    ])

    // Виджеты добавляются только при первом создании дашборда, ровно по одному вызову на элемент
    // DASHBOARD_WIDGETS — доказывает, что цикл создания виджетов реально проходит по всему списку,
    // а не по подмножеству/дублирует один и тот же виджет.
    const widgetAddCalls = callsMatching(
      runCalls,
      a => a[0] === 'dashboard' && a[1] === 'widget' && a[2] === 'add',
    )
    expect(widgetAddCalls).toHaveLength(DASHBOARD_WIDGETS.length)
  })

  // [review phase 1, iteration 2] Раньше цикл виджетов не имел покрытия на случай сбоя посреди
  // добавления — исключение молча пробрасывалось дальше без понятного сообщения о том, что
  // дашборд уже создан и какие виджеты остались недобавленными.
  it('при сбое на середине цикла виджетов бросает понятную ошибку с именем упавшего и списком недобавленных виджетов', async () => {
    const { runner, runCalls } = createFakeRunner()
    const failingWidgetIndex = 2
    const failingWidgetName = DASHBOARD_WIDGETS[failingWidgetIndex]?.name
    const originalRun = runner.run
    runner.run = args => {
      if (
        args[0] === 'dashboard' &&
        args[1] === 'widget' &&
        args[2] === 'add' &&
        args[3] === 'mycomp-ey/kinoshka' &&
        args[4] === DASHBOARD_TITLE &&
        args[5] === failingWidgetName
      ) {
        throw new Error('network error')
      }
      originalRun(args)
    }

    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    await expect(main(runner)).rejects.toThrow(
      new RegExp(
        `${escapeRegExp(failingWidgetName ?? '')}.*\\(${failingWidgetIndex + 1}/${DASHBOARD_WIDGETS.length}\\).*network error`,
      ),
    )

    // Дашборд уже был создан до сбоя в цикле виджетов — это часть ожидаемого (не идеального, но
    // документированного) поведения, а не то, что нужно откатывать.
    expect(
      callsMatching(runCalls, a => a[0] === 'dashboard' && a[1] === 'create'),
    ).toHaveLength(1)
    // Виджеты до сбоя были добавлены (0, 1 — сбой происходит на индексе 2), упавший виджет (2) и
    // все виджеты после него — нет.
    const widgetAddCalls = callsMatching(
      runCalls,
      a => a[0] === 'dashboard' && a[1] === 'widget' && a[2] === 'add',
    )
    expect(widgetAddCalls).toHaveLength(failingWidgetIndex)
  })

  it('резолвит teamId из первой команды в списке (извлечение поля id из list-ответа)', async () => {
    const { runner, runCalls } = createFakeRunner({
      team: [{ id: '999888777', slug: 'other-team' }],
    })

    await main(runner)

    const errorRateCreateCall = callsMatching(
      runCalls,
      a => a[0] === 'alert' && a[1] === 'metrics' && a[2] === 'create',
    )[0]
    expect(errorRateCreateCall?.join(' ')).toContain(
      '"targetIdentifier":"999888777"',
    )
  })
})
