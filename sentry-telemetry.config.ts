// Пороговые значения + чистые argv-builders для provisioning-скрипта
// (provision-sentry-telemetry.ts) поверх `sentry` CLI — тот же приём вынесения чистой логики в
// отдельный тестируемый модуль, что sentry.config.ts/bundle.config.ts (см. AGENTS.md). Этот файл
// не выполняет ничего сам — только строит argv-массивы и константы; сам вызов `sentry` (через
// child_process.execFileSync) живёт в provision-sentry-telemetry.ts.
//
// См. docs/plans/20260915-telemetry-dashboard-sentry-alerts.md, Task 3, для истории решений
// (Issue Alert → count-based Metric Alert → failure_rate() Metric Alert) и живого лога проверки
// ниже.

export type TelemetryContext = {
  org: string
  project: string
  teamId: string
}

// ---------------------------------------------------------------------------------------------
// Живой пробный вызов 2026-09-16 (`mycomp-ey`/`kinoshka`, sentry CLI 0.44.1) — что подтверждено,
// что осталось best-effort-допущением. Полный лог команд — в прогресс-файле задачи (append-progress,
// "task 3"). Кратко:
//
// 1. `--query ''` (пустая строка) НЕВАЛИДНА — `sentry alert metrics create ... --query '' --dry-run`
//    падает мгновенно (клиентская проверка CLI, без похода в сеть) с "Error: query cannot be
//    empty." Значит билдеры ниже используют непустой METRIC_ALERT_QUERY, а не '' — единственная
//    оговорка чек-листа, для которой есть однозначный, воспроизводимый ответ.
//
// 2. ⚠️ БОЛЕЕ ГЛУБОКАЯ НАХОДКА, не покрытая формулировкой чек-листа заранее: реальное (не
//    --dry-run) создание метрик-алерта на `--dataset transactions` для этого аккаунта ОТКЛОНЕНО
//    сервером целиком, независимо от aggregate/query/alertThreshold:
//      "Creation of transaction-based alerts is disabled, as we migrate to the span dataset.
//       Create span-based alerts (dataset: events_analytics_platform) with the is_transaction:true
//       filter instead."
//    При этом `sentry alert metrics create --dataset spans` (единственное близкое значение из
//    перечня, который клиентская валидация CLI вообще принимает: errors/transactions/sessions/
//    events/spans/metrics — то есть без `events_analytics_platform` вовсе) даёт другую ошибку от
//    сервера: "Invalid dataset for this query type. Valid datasets are ['eventsanalyticsplatform',
//    'performancemetrics', 'transactions']". Итог: установленная версия sentry CLI (0.44.1) НЕ
//    ИМЕЕТ рабочего значения --dataset для создания этого типа алерта на этом аккаунте — ни
//    задокументированное 'transactions' (заблокировано сервером), ни ближайшая альтернатива
//    'spans' (не мапится в ожидаемое сервером 'eventsanalyticsplatform'/'performancemetrics').
//
// 3. Отдельно от (2): реальный (не dry-run) payload, который в итоге принимает сервер для
//    триггеров, — НЕ тот простой `{"alertThreshold":X,"actions":[...]}` из --help/примеров.
//    Экспериментально дошли до необходимости `type`("gt"/"lt"), `comparison`(число-порог),
//    `conditionResult`(числовой priority-level, "high" в виде строки сервер отверг, число 75
//    принял) — ПЛЮС обязательное второе ("resolve") условие в массиве триггеров ("Resolution
//    condition required for metric issue detector."). Ни --help, ни примеры в нём об этом не
//    говорят — похоже, аккаунт уже переведён на новый unified Detector/workflow-engine формат
//    алертов, а `--trigger`-флаг CLI 0.44.1 документирован по старому (IncidentRule) формату.
//
// 4. Из-за (2) ни один вызов не дошёл до стадии, где реально проверяется числовой масштаб
//    `alertThreshold` (0-100 vs 0-1) — сервер отбрасывал запрос раньше, на этапе выбора датасета.
//    ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT ниже — задокументированное best-effort-допущение
//    (не живой факт): по публичной документации Sentry Metric Alert Rules процентные aggregate
//    (failure_rate()/apdex() и т.п.) хранятся и отображаются в UI как число 0-100 (значение "5"
//    читается как "5%"), а не как доля 0-1. ТРЕБУЕТ живой проверки в Post-Completion — см. новый
//    пункт там же — до того, как этому значению можно доверять при реальном запуске
//    `make sentry-telemetry`.
//
// 5. Уборка: ни один из пробных вызовов не создал реальный объект в Sentry — каждый падал с
//    400/локальной валидацией CLI до персиста. Подтверждено повторным
//    `sentry alert metrics list mycomp-ey/ --json --fresh` → `{"data": [], ...}` после всех
//    попыток. Удалять нечего.
// ---------------------------------------------------------------------------------------------

// Непустой query для обоих Metric Alert'ов на dataset=transactions — "все транзакции без доп.
// фильтра" (см. находку 1 выше: '' отвергается клиентской валидацией CLI).
export const METRIC_ALERT_QUERY = 'event.type:transaction'

// 60 минут, не 15 — см. Technical Details плана, "данные есть, но статистически незначимы":
// у Sentry Metric Alerts нет min-sample-guard для percentile/rate-агрегатов, окно расширено на
// период soak, а не заужено до "отзывчивого" 5-15-минутного значения.
export const ERROR_ALERT_WINDOW_MINUTES = 60
export const LCP_ALERT_WINDOW_MINUTES = 60

// Best-effort допущение — см. находку 4 выше: масштаб НЕ подтверждён живым созданием (сервер
// отбрасывает запрос раньше, на этапе dataset=transactions). 5 означает "5%" в предположении о
// 0-100 шкале, по прецеденту публичной документации Sentry для процентных aggregate. Живая
// проверка — Post-Completion, после решения находки 2 (CLI/dataset несовместимость).
export const ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT = 5

// LCP порог в мс — тот же p75(measurements.lcp), что и Web Vitals "хорошо" граница (2.5s),
// используемая индустриально (Core Web Vitals). Единица (мс, не 0-100 шкала) не вызывает
// сомнений — measurements.lcp сам по себе всегда в мс, здесь неоднозначности нет.
export const LCP_P75_THRESHOLD_MS = 2500

export const ERROR_RATE_ALERT_NAME =
  'Kinoshka: error rate (failure_rate) above threshold'
export const LCP_ALERT_NAME = 'Kinoshka: LCP P75 above threshold'
export const DASHBOARD_TITLE = 'Kinoshka Telemetry'

export type MetricAlertConfig = {
  name: string
  query: string
  aggregate: string
  // Намеренно 'transactions', как задокументировано в Technical Details плана — см. находку 2
  // выше про то, что реальное создание на этом датасете сейчас отклоняется сервером. Не меняем
  // здесь на 'spans' умозрительно: ни одно из значений, доступных в CLI 0.44.1, не подтверждено
  // живым успешным созданием, значит выбор новой строки был бы такой же непроверенной догадкой,
  // как и текущая. Решение — Post-Completion, после того как разрешится сама CLI/dataset
  // несовместимость (апдейт CLI, либо создание через Sentry UI).
  dataset: 'transactions'
  timeWindowMinutes: number
  alertThreshold: number
}

export const ERROR_RATE_METRIC_ALERT_CONFIG: MetricAlertConfig = {
  name: ERROR_RATE_ALERT_NAME,
  query: METRIC_ALERT_QUERY,
  aggregate: 'failure_rate()',
  dataset: 'transactions',
  timeWindowMinutes: ERROR_ALERT_WINDOW_MINUTES,
  alertThreshold: ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT,
}

export const LCP_METRIC_ALERT_CONFIG: MetricAlertConfig = {
  name: LCP_ALERT_NAME,
  query: METRIC_ALERT_QUERY,
  aggregate: 'p75(measurements.lcp)',
  dataset: 'transactions',
  timeWindowMinutes: LCP_ALERT_WINDOW_MINUTES,
  alertThreshold: LCP_P75_THRESHOLD_MS,
}

// ⚠️ ИТОГ (не смягчать при будущих правках): в текущем виде этот билдер производит argv, которое
// СЕРВЕР ГАРАНТИРОВАННО ОТКЛОНИТ при реальном запуске `make sentry-telemetry` — это не "порог не
// проверен", а "создание алерта не работает вообще". Две независимые причины (обе см. находки 2/3
// выше): (а) `--dataset transactions` отклоняется backend'ом целиком ("Creation of
// transaction-based alerts is disabled..."), а единственная альтернатива, которую принимает
// клиентская валидация установленной версии CLI (`--dataset spans`), не совпадает с тем, что
// ожидает сервер ("Invalid dataset..."); (б) даже если бы датасет прошёл, реальный `--trigger`
// payload, который принимает backend, шире документированного в `--help` — нужны
// `type`/`comparison`/`conditionResult` и обязательное второе ("resolve") условие, которых здесь
// нет. Форма ниже — дословно из живого `sentry alert metrics create --help` (см. Technical Details
// плана), сознательно НЕ заменена на экспериментально нащупанную форму, потому что последняя не
// была доведена до успешного создания и сама по себе была бы такой же непроверенной догадкой.
// Не запускать `make sentry-telemetry` против прода, ожидая рабочего результата, до разрешения
// одного из трёх путей в Post-Completion плана.
export const buildMetricAlertArgs = (
  ctx: TelemetryContext,
  config: MetricAlertConfig,
): string[] => [
  ctx.org,
  '--name',
  config.name,
  '--query',
  config.query,
  '--aggregate',
  config.aggregate,
  '--dataset',
  config.dataset,
  '--time-window',
  String(config.timeWindowMinutes),
  '--project',
  ctx.project,
  '--trigger',
  JSON.stringify([
    {
      alertThreshold: config.alertThreshold,
      actions: [
        {
          id: 'sentry.mail.actions.NotifyEmailAction',
          targetType: 'Team',
          // Строка, не Number(ctx.teamId) — team id из Sentry API снежинко-подобный (снятый живым
          // team list, см. пример в sentry-telemetry.config.test.ts, 16 цифр) и может в будущем
          // превысить Number.MAX_SAFE_INTEGER, из-за чего JS Number молча округлил бы значение.
          // Строка ничего не теряет и не требует представления о реальной ожидаемой схеме сервера
          // (которая всё равно best-effort, см. комментарий у buildMetricAlertArgs выше).
          targetIdentifier: ctx.teamId,
        },
      ],
    },
  ]),
]

export const buildErrorRateMetricAlertArgs = (
  ctx: TelemetryContext,
  config: MetricAlertConfig = ERROR_RATE_METRIC_ALERT_CONFIG,
): string[] => buildMetricAlertArgs(ctx, config)

export const buildLcpMetricAlertArgs = (
  ctx: TelemetryContext,
  config: MetricAlertConfig = LCP_METRIC_ALERT_CONFIG,
): string[] => buildMetricAlertArgs(ctx, config)

// `sentry dashboard create` ожидает единый variadic-аргумент "[<org/project>] <title>" — см.
// живой --help.
export const buildDashboardCreateArgs = (
  ctx: TelemetryContext,
  title: string,
): string[] => [`${ctx.org}/${ctx.project}`, title]

export type DashboardWidgetDisplay = 'big_number' | 'line' | 'table'

export type DashboardWidget = {
  name: string
  display: DashboardWidgetDisplay
  dataset: string
  query: string
  col: number
  row: number
  width: number
  height: number
}

// 6-колоночная сетка (см. `sentry dashboard widget add --help`, "Layout flags ... control widget
// position and size in the 6-column dashboard grid"): каждая строка (одинаковый `row`) должна
// суммарно занимать ровно 6 колонок, иначе CLI молча авто-разложит виджеты иначе (см. Technical
// Details плана). Размеры по типу зафиксированы там же: big_number 2×1, line 3×2, table 6×2.
export const DASHBOARD_WIDGETS: DashboardWidget[] = [
  // Строка 0 — три big_number (2+2+2=6).
  {
    name: 'Failure rate',
    display: 'big_number',
    dataset: 'transactions',
    query: 'failure_rate',
    col: 0,
    row: 0,
    width: 2,
    height: 1,
  },
  {
    name: 'Issues',
    display: 'big_number',
    dataset: 'issue',
    query: 'count',
    col: 2,
    row: 0,
    width: 2,
    height: 1,
  },
  {
    name: 'Throughput',
    display: 'big_number',
    dataset: 'transactions',
    query: 'count',
    col: 4,
    row: 0,
    width: 2,
    height: 1,
  },
  // Строка 1 — два line-графика (3+3=6). LCP — единственный виджет, прямо названный в Technical
  // Details плана ("line-график P75 LCP"). INP на этом же датасете рядом — см. TODO ниже.
  {
    name: 'LCP P75',
    display: 'line',
    dataset: 'transactions',
    query: 'p75:measurements.lcp',
    col: 0,
    row: 1,
    width: 3,
    height: 2,
  },
  // TODO(Post-Completion): датасет/query не подтверждены живыми ingested-данными — Technical
  // Details плана прямо говорит, что INP (и в v9/v10 CLS) в @sentry/react — standalone span, не
  // measurement на транзакции, вероятный датасет 'spans'/'events_analytics_platform', не
  // 'transactions'. Значение здесь — плейсхолдер, чтобы виджет физически присутствовал на
  // дашборде (видимость, не алерт — roadmap просит алерт только на LCP), не гарантированно рабочий
  // API-вызов.
  {
    name: 'INP P75',
    display: 'line',
    dataset: 'transactions',
    query: 'p75:measurements.inp',
    col: 3,
    row: 1,
    width: 3,
    height: 2,
  },
  // Строка 2 — CLS (тот же TODO, что INP выше) + компаньон-виджет throughput-тренда. Компаньон
  // добавлен исключительно ради инварианта сетки (сумма width в строке = 6): CLS сам по себе
  // (line, width 3) не может ни делить строку с full-width table (см. строка 3), ни быть единств.
  // виджетом в строке без нарушения суммы. Throughput-тренд — легитимный самостоятельный виджет
  // (тренд запросов во времени, дополняющий big_number "Throughput" выше), а не заглушка без
  // смысла.
  {
    name: 'CLS P75',
    display: 'line',
    dataset: 'transactions',
    query: 'p75:measurements.cls',
    col: 0,
    row: 2,
    width: 3,
    height: 2,
  },
  {
    name: 'Throughput trend',
    display: 'line',
    dataset: 'transactions',
    query: 'count',
    col: 3,
    row: 2,
    width: 3,
    height: 2,
  },
  // Строка 3 — table, full-width (6).
  {
    name: 'Top issues',
    display: 'table',
    dataset: 'issue',
    query: 'count',
    col: 0,
    row: 3,
    width: 6,
    height: 2,
  },
]

// `sentry dashboard widget add` — единый variadic-аргумент "[<org/project>] <dashboard> <title>".
export const buildWidgetArgs = (
  ctx: TelemetryContext,
  dashboardTitle: string,
  widget: DashboardWidget,
): string[] => [
  `${ctx.org}/${ctx.project}/${dashboardTitle}`,
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
]

// Грамматика target-аргумента различается по командам (см. Context плана, живой --help):
// metrics/dashboard/team — <org>/ (со слэшем, org-scoped, "project part is ignored"). Все — с
// --json --fresh, чтобы обход кэша CLI не ломал идемпотентность exists-проверки. Принимают
// Pick<TelemetryContext, ...> вместо полного TelemetryContext — buildTeamListArgs вызывается ДО
// того, как teamId вообще известен (сам team list его и резолвит), так что требовать полный
// контекст с teamId было бы некорректно.
//
// Note: buildIssueAlertListArgs (<org>/<project>, без слэша — грамматика Issue Alert list) была
// удалена ревью-фиксом — дизайн давно перешёл с Issue Alert на Metric Alert (failure_rate(), см.
// "Принятые решения" в плане), и main() никогда её не вызывал; неиспользуемый билдер был мёртвым
// кодом с момента написания, оставленный только потому что был написан раньше пивота.
export const buildMetricAlertListArgs = (
  ctx: Pick<TelemetryContext, 'org'>,
): string[] => [`${ctx.org}/`, '--json', '--fresh']

export const buildDashboardListArgs = (
  ctx: Pick<TelemetryContext, 'org'>,
): string[] => [`${ctx.org}/`, '--json', '--fresh']

export const buildTeamListArgs = (
  ctx: Pick<TelemetryContext, 'org'>,
): string[] => [`${ctx.org}/`, '--json', '--fresh']

// create-if-missing, не полная синхронизация (см. Technical Details плана, "Idempotency" —
// сознательно неточное слово) — просто "имя уже есть в списке?".
export const shouldCreate = (
  existingNames: string[],
  desiredName: string,
): boolean => !existingNames.includes(desiredName)
