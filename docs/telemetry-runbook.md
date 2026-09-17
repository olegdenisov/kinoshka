# Telemetry runbook

Раннбук для ручных шагов из roadmap-пункта `2.5.7`, которые не автоматизируются кодом в этом
репозитории: Plausible Custom Goals/Funnels (UI-конфигурация на стороне Plausible, API для них на
используемом тарифе нет — см. `docs/plans/completed/20260915-telemetry-dashboard-sentry-alerts.md`),
установка/авторизация `sentry` CLI и запуск provisioning-скрипта, а также зафиксированное решение
про `tracePropagationTargets`.

## 1. Plausible Custom Goals — имена для уже существующих событий

Приложение уже шлёт четыре кастомных события через `trackEvent()`
(`src/shared/lib/analytics/analytics.ts`, см. AGENTS.md → «Web Vitals + Analytics»). Plausible не
считает произвольные custom-события конверсией сама по себе — каждое нужно завести как **Custom
Goal** в UI (Site Settings → Goals → Add goal → Custom event), указав **точное** имя события (case
sensitive, включая пробелы):

| Custom Goal (Plausible UI) | Имя события в коде                    | Где триггерится                                                                 |
| --------------------------- | -------------------------------------- | -------------------------------------------------------------------------------- |
| `pageview`                  | `trackEvent('pageview')`               | `src/app/layouts/AppLayout.tsx` — на каждый `location.pathname`                   |
| `search submitted`          | `trackEvent('search submitted')`       | `src/pages/search/model/useSearchAnalytics.ts` — settled non-empty `?q`          |
| `filter changed`            | `trackEvent('filter changed')`         | `applyFilters` в `src/features/catalog-filter/model/useFilterState.ts`           |
| `favorite added`            | `trackEvent('favorite added')`         | ветка добавления в `toggle(id)`, `src/features/favorites/model/useFavorites.ts`  |

Заводить нужно ровно эти четыре строки как имя Custom Goal — без перевода на русский, без
изменения регистра/пробелов, иначе Goal не увидит событие. `pageview` — зарезервированное имя
Plausible (см. AGENTS.md — `.manual.js` скрипт отключает автоматический pageview-трекинг именно
чтобы `trackPageview()` управлял этим событием явно), в UI оно обычно уже присутствует как
дефолтный Goal — проверить перед созданием дубликата.

## 2. Пример funnel'а — конверсия по ключевому flow

Plausible Funnels (Site Settings → Funnels → Add funnel) строится как упорядоченный список из
существующих Goals (шаг 1). Пример funnel'а «поиск → добавление в избранное»:

1. `pageview`
2. `search submitted`
3. `favorite added`

Это показывает долю сессий, которые дошли от простого захода на сайт до explicit-поиска и затем до
добавления фильма в избранное — самый показательный сквозной flow в этом приложении (остальные два
события, `filter changed`, можно добавить как дополнительный необязательный шаг между 2 и 3, если
хочется отдельно видеть влияние фильтров на конверсию).

**Оговорка:** Funnels — платная фича Plausible (доступность зависит от тарифного плана аккаунта);
на используемом сейчас тарифе не подтверждено, что Funnels включены. Если Funnels недоступны на
тарифе — тот же анализ можно частично сделать вручную через обычные Goal conversion rates (посчитать
% сессий с `search submitted` относительно всех `pageview`, затем % с `favorite added` относительно
`search submitted`), сравнивая цифры по отдельным Goals в стандартном dashboard.

## 3. Установка и авторизация `sentry` CLI + provisioning

```bash
curl https://cli.sentry.dev/install -fsS | bash
sentry auth login
```

`sentry auth login` открывает браузер для OAuth-авторизации CLI против org `mycomp-ey`. После
успешной авторизации CLI хранит токен локально (не в репозитории) — этот шаг разовый на машине, не
на репозиторий.

Дальше — provisioning telemetry-as-code (Metric Alert на error rate, Metric Alert на LCP P75,
Dashboard «Kinoshka Telemetry»):

```bash
make sentry-telemetry
```

Команда читает `SENTRY_ORG`/`SENTRY_PROJECT` из `.env.local` (через `node
--env-file-if-exists=.env.local`), резолвит team динамически через `sentry team list`, и создаёт
недостающие объекты (`create-if-missing`, не полная синхронизация — см. `sentry-telemetry.config.ts`
и `provision-sentry-telemetry.ts`). Требует, чтобы `sentry auth login` уже был выполнен.

**⚠️ Известный блокер на момент написания (2026-09-16, sentry CLI 0.44.1):** оба
`alert metrics create`-вызова гарантированно падают на реальном аккаунте — сервер отклоняет
`--dataset transactions` целиком (миграция на span dataset), а доступный клиенту `--dataset spans`
не совпадает с ожидаемым сервером датасетом. Полный разбор и три возможных пути решения — в
Post-Completion соответствующего плана
(`docs/plans/completed/20260915-telemetry-dashboard-sentry-alerts.md`). Перед реальным запуском
`make sentry-telemetry` в проде — сначала разобрать этот блокер (обновить CLI до версии, знающей
`events_analytics_platform`, либо создать алерты вручную через UI и сверить схему, либо дождаться,
пока Sentry снова разрешит `dataset: transactions`).

## 4. `tracePropagationTargets` — решение и условие пересмотра

`tracePropagationTargets` **не передаётся** в `Sentry.init(...)` (`src/app/sentry.ts`) — используется
дефолт SDK. Дефолт матчит только same-origin/localhost; все запросы к API этого приложения идут на
абсолютный кросс-origin `https://api.poiskkino.dev`, поэтому заголовки `sentry-trace`/`baggage` при
дефолтной конфигурации туда и так не уходят — расширять список смысла нет.

**Условие, при котором стоит пересмотреть:** если понадобится distributed tracing до
`api.poiskkino.dev` (сквозные трейсы клиент → API), сначала нужно живым запросом проверить, что
сторонний API отдаёт `Access-Control-Allow-Headers`, разрешающий `sentry-trace`/`baggage` — иначе
добавление этих заголовков к cross-origin запросу сломает сам запрос из-за CORS preflight. Только
после подтверждения CORS-совместимости — добавлять `https://api.poiskkino.dev` в
`tracePropagationTargets` в `sentry.ts`.
