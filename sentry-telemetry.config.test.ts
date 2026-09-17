import { describe, expect, it } from 'vitest'

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
  type DashboardWidget,
  type TelemetryContext,
} from './sentry-telemetry.config'

// Фиксированный тестовый контекст (см. Testing Strategy плана — "ожидаемый argv на фиксированной
// тестовой TelemetryContext").
const CTX: TelemetryContext = {
  org: 'mycomp-ey',
  project: 'kinoshka',
  teamId: '4512052151975936',
}

describe('buildErrorRateMetricAlertArgs', () => {
  it('строит ожидаемый argv для failure_rate() Metric Alert', () => {
    expect(buildErrorRateMetricAlertArgs(CTX)).toEqual([
      'mycomp-ey',
      '--name',
      ERROR_RATE_METRIC_ALERT_CONFIG.name,
      '--query',
      'event.type:transaction',
      '--aggregate',
      'failure_rate()',
      '--dataset',
      'transactions',
      '--time-window',
      '60',
      '--project',
      'kinoshka',
      '--trigger',
      JSON.stringify([
        {
          alertThreshold: 5,
          actions: [
            {
              id: 'sentry.mail.actions.NotifyEmailAction',
              targetType: 'Team',
              targetIdentifier: '4512052151975936',
            },
          ],
        },
      ]),
    ])
  })

  it('--query никогда не пустая строка (см. живой пробный вызов — "query cannot be empty")', () => {
    const args = buildErrorRateMetricAlertArgs(CTX)
    const queryIndex = args.indexOf('--query')
    expect(queryIndex).toBeGreaterThanOrEqual(0)
    expect(args[queryIndex + 1]).not.toBe('')
  })
})

describe('buildLcpMetricAlertArgs', () => {
  it('строит ожидаемый argv для p75(measurements.lcp) Metric Alert', () => {
    expect(buildLcpMetricAlertArgs(CTX)).toEqual([
      'mycomp-ey',
      '--name',
      LCP_METRIC_ALERT_CONFIG.name,
      '--query',
      'event.type:transaction',
      '--aggregate',
      'p75(measurements.lcp)',
      '--dataset',
      'transactions',
      '--time-window',
      '60',
      '--project',
      'kinoshka',
      '--trigger',
      JSON.stringify([
        {
          alertThreshold: 2500,
          actions: [
            {
              id: 'sentry.mail.actions.NotifyEmailAction',
              targetType: 'Team',
              targetIdentifier: '4512052151975936',
            },
          ],
        },
      ]),
    ])
  })
})

describe('buildDashboardCreateArgs', () => {
  it('строит "<org>/<project>" + title одним variadic-аргументом', () => {
    expect(buildDashboardCreateArgs(CTX, DASHBOARD_TITLE)).toEqual([
      'mycomp-ey/kinoshka',
      'Kinoshka Telemetry',
    ])
  })
})

describe('buildWidgetArgs', () => {
  // [review phase 1] Изначально проверялся только big_number-виджет — опечатка/регрессия в
  // построении аргументов для line/table осталась бы незамеченной. Явно перебираем по одному
  // виджету каждого display-типа, а не полагаемся на структурное сходство builder'а.
  const widgetsByDisplay = Object.fromEntries(
    DASHBOARD_WIDGETS.map(w => [w.display, w]),
  ) as Record<(typeof DASHBOARD_WIDGETS)[number]['display'], DashboardWidget>

  it.each(['big_number', 'line', 'table'] as const)(
    'строит "<org>/<project>/<dashboard>" + все layout/dataset/query флаги для display=%s',
    display => {
      const widget = widgetsByDisplay[display]
      expect(buildWidgetArgs(CTX, DASHBOARD_TITLE, widget)).toEqual([
        'mycomp-ey/kinoshka/Kinoshka Telemetry',
        widget.name,
        '--display',
        widget.display,
        '--dataset',
        widget.dataset,
        '--query',
        widget.query,
        '--col',
        String(widget.col),
        '--row',
        String(widget.row),
        '--width',
        String(widget.width),
        '--height',
        String(widget.height),
      ])
    },
  )
})

describe('DASHBOARD_WIDGETS — инвариант сетки', () => {
  it('сумма width виджетов в каждой строке (row) равна 6', () => {
    const widthByRow = new Map<number, number>()
    for (const w of DASHBOARD_WIDGETS) {
      widthByRow.set(w.row, (widthByRow.get(w.row) ?? 0) + w.width)
    }
    for (const [row, width] of widthByRow) {
      expect(width, `row ${row}`).toBe(6)
    }
  })

  it('размеры виджетов соответствуют типу display (big_number 2×1, line 3×2, table 6×2)', () => {
    for (const w of DASHBOARD_WIDGETS) {
      if (w.display === 'big_number') {
        expect([w.width, w.height], w.name).toEqual([2, 1])
      } else if (w.display === 'line') {
        expect([w.width, w.height], w.name).toEqual([3, 2])
      } else {
        expect([w.width, w.height], w.name).toEqual([6, 2])
      }
    }
  })

  // [review phase 1] Сумма width в строке равна 6 не гарантирует отсутствие пересечений колонок —
  // например, два виджета width=3 на col=0 и col=1 тоже дали бы сумму 6 в другой комбинации виджетов
  // той же строки, но реально перекрывались бы на сетке. Проверяем и границы (col>=0,
  // col+width<=6), и попарное непересечение интервалов [col, col+width) для виджетов одного row.
  it('виджеты одного row не пересекаются по колонкам и не выходят за границы сетки (0..6)', () => {
    const byRow = new Map<number, DashboardWidget[]>()
    for (const w of DASHBOARD_WIDGETS) {
      byRow.set(w.row, [...(byRow.get(w.row) ?? []), w])
    }

    for (const [row, widgets] of byRow) {
      for (const w of widgets) {
        expect(
          w.col,
          `row ${row} / ${w.name}: col >= 0`,
        ).toBeGreaterThanOrEqual(0)
        expect(
          w.col + w.width,
          `row ${row} / ${w.name}: col + width <= 6`,
        ).toBeLessThanOrEqual(6)
      }

      const sorted = [...widgets].sort((a, b) => a.col - b.col)
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1]
        const curr = sorted[i]
        expect(
          curr.col,
          `row ${row}: "${curr.name}" (col=${curr.col}) перекрывает "${prev.name}" (col=${prev.col}, width=${prev.width})`,
        ).toBeGreaterThanOrEqual(prev.col + prev.width)
      }
    }
  })
})

describe('build*ListArgs — грамматика target-аргумента', () => {
  it('buildMetricAlertListArgs — <org>/ с завершающим слэшем (org-scoped)', () => {
    expect(buildMetricAlertListArgs(CTX)).toEqual([
      'mycomp-ey/',
      '--json',
      '--fresh',
    ])
  })

  it('buildDashboardListArgs — <org>/ с завершающим слэшем (org-scoped)', () => {
    expect(buildDashboardListArgs(CTX)).toEqual([
      'mycomp-ey/',
      '--json',
      '--fresh',
    ])
  })

  it('buildTeamListArgs — <org>/ с завершающим слэшем (org-scoped)', () => {
    expect(buildTeamListArgs(CTX)).toEqual(['mycomp-ey/', '--json', '--fresh'])
  })
})

describe('shouldCreate', () => {
  it('true, если имени нет в списке существующих', () => {
    expect(shouldCreate(['A', 'B'], 'C')).toBe(true)
  })

  it('false, если имя уже есть в списке существующих (edge case)', () => {
    expect(shouldCreate(['A', 'B'], 'B')).toBe(false)
  })

  it('true для пустого списка существующих', () => {
    expect(shouldCreate([], 'C')).toBe(true)
  })
})
