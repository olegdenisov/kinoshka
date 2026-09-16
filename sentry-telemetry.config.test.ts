import { describe, expect, it } from 'vitest'

import {
  buildDashboardCreateArgs,
  buildDashboardListArgs,
  buildErrorRateMetricAlertArgs,
  buildIssueAlertListArgs,
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
              targetIdentifier: 4512052151975936,
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
              targetIdentifier: 4512052151975936,
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
  it('строит "<org>/<project>/<dashboard>" + все layout/dataset/query флаги', () => {
    const widget = DASHBOARD_WIDGETS[0]
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
  })
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
})

describe('build*ListArgs — грамматика target-аргумента', () => {
  it('buildIssueAlertListArgs — <org>/<project> без завершающего слэша', () => {
    expect(buildIssueAlertListArgs(CTX)).toEqual([
      'mycomp-ey/kinoshka',
      '--json',
      '--fresh',
    ])
  })

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
