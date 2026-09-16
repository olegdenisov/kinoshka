# 2.5.7 Telemetry дашборд — Sentry Performance + alerting/dashboard-as-code + Sentry MCP

## Overview

Roadmap-пункт `2.5.7` (`plans/roadmap.md`) требует три вещи:

- Sentry — alert на error rate > X%.
- Web Vitals в Sentry/PostHog — алёрт на P75 LCP > 2.5s.
- PostHog/Plausible — конверсия по ключевым flows.

Особенность пункта: большая часть работы — это настройка во внешних сервисах (Sentry, Plausible), а не код в репозитории. У `sentry` CLI (см. skill `sentry-cli`) есть `alert issues create`/`alert metrics create` и `dashboard create`/`widget add` — то есть Sentry-часть можно провизионить декларативно, версионируемым скриптом, а не только руками в UI. У Plausible на используемом тарифе нет API для алертов/целей — там остаётся ручной раннбук.

Этот план прошёл два раунда ревью (Sonnet, затем Opus) — оба раза с живой проверкой фактов через `sentry` CLI/API/`node_modules`, а не по памяти/документации. Ниже — уже исправленная версия; история фиксов не переписывается заново в тексте, только итоговое состояние.

### Принятые решения (согласованы с пользователем в ходе планирования)

1. **Web Vitals переезжают из Plausible в Sentry Performance.** Сейчас (`2.5.2`) `onLCP`/`onINP`/`onCLS` шлются как кастомные Plausible-события (`web vital: lcp` и т.д.) — `2.5.1` сознательно не включал Sentry Performance/tracing из-за параметризованного роута `/movie/:id` (один transaction на фильм без спец-интеграции). Это больше не блокер: `Sentry.reactRouterBrowserTracingIntegration` (не deprecated `reactRouterV7BrowserTracingIntegration`, см. Technical Details) + `Sentry.wrapCreateBrowserRouter` группируют параметризованные роуты в один transaction name. Включаем `tracesSampleRate`, Sentry сам собирает LCP/INP/CLS как measurements/span'ы на транзакциях — отдельный пакет `web-vitals` и Plausible-события `web vital: *` удаляются.
2. **Sentry MCP** (`https://mcp.sentry.dev/mcp`) добавляется в `.mcp.json` в корне репозитория (project-scoped, коммитится).
3. **Error-rate alert реализован как Metric Alert на `failure_rate()`, а не Issue Alert.** Прошло уже две итерации этого решения — обе задокументированы, чтобы не повторять пройденный путь:
   - Изначально обсуждалась формулировка "issue замечен ≥10 уникальными пользователями за 60 минут" (Issue Alert). От неё отказались во втором раунде ревью, потому что `sentry alert issues create --condition` целится в workflow-native JSON-формат, чей `type` для "unique user frequency" не задокументирован и не подтверждён живым пробным вызовом — исследовательский риск прямо в середине задачи.
   - Промежуточная замена — count-based Metric Alert (`count()` событий на `errors`-датасете ≥10 за 60 минут) — оказалась **семантически неверной**: это абсолютное число, а не _rate_, что не соответствует ни названию "error rate", ни буквальной формулировке roadmap ("error rate > X%"), и при росте трафика алертило бы просто из-за большего числа пользователей, а не из-за реальной деградации (найдено внешним ревью Codex).
   - Финальное решение — `failure_rate()` (доля транзакций со статусом, отличным от `ok`/`cancelled`/`unknown`) на `transactions`-датасете, с процентным порогом. Это настоящий rate, не требует недокументированного workflow-JSON (в отличие от Issue Alert) и переиспользует те же transactions, что уже собираются для LCP-алерта (единая tracing-инфраструктура вместо отдельного канала на `errors`-датасете). **Открытый риск, требующий живой проверки в Post-Completion**: не подтверждено, флипает ли `@sentry/react`'s browser tracing статус транзакции при неотловленном исключении в чистом SPA (в отличие от серверных SDK, где статус транзакции естественно берётся из HTTP-кода ответа) — если `failure_rate()` на практике всегда читается как `0`, несмотря на реальные ошибки, нужен откат на явно переименованный "error count" Metric Alert (`count()` на `errors`), а не молчаливое использование метрики, которая никогда не сработает.

**Явно вне рамок этого плана:**

- Живой запуск provisioning-скрипта против реального Sentry-аккаунта (нужна `sentry auth login`, уже выполнено на этой машине — см. Context) — сам запуск и создание правил в проде остаются Post-Completion, скрипт лишь пишется и юнит-тестируется здесь.
- **Живая проверка через реальный трафик/трейсы** (что транзакция `/movie/:id` реально группируется, что алерты реально срабатывают) — Post-Completion, а не Implementation Steps: сборка с реальным `VITE_SENTRY_DSN`/`SENTRY_AUTH_TOKEN` из `.env.local` создаёт настоящий release и заливает source maps в прод-Sentry — смешивать это с обычной работой над задачами плана не стоит.
- Настройка Plausible Custom Goals/Funnel в UI — Post-Completion.
- OAuth-авторизация Sentry MCP внутри самой Claude Code сессии — Post-Completion.
- Переключение `tracePropagationTargets` на `api.poiskkino.dev` — сознательно НЕ делаем в этом плане (см. Technical Details, риск CORS).

## Context (from discovery)

- **Sentry error tracking** (`src/app/sentry.ts`, `src/app/sentry.test.ts`) — только `Sentry.init({ dsn, release, environment, sendDefaultPii: false, beforeSend })`, без `integrations`/`tracesSampleRate`. `initSentry()` — no-op вне `PROD`/без `VITE_SENTRY_DSN`, тестируется через `vi.stubEnv` + `vi.mock('@sentry/react', ...)`.
- **`sentry.config.ts`** (корень репо) — устоявшийся паттерн: чистые, юнит-тестируемые функции (`buildRelease`, `isSentryEnabled`, `resolveBuildSourcemap`), потребляемые из `vite.config.ts`.
- **Web Vitals → Plausible** (`src/shared/lib/analytics/reportWebVitals.ts` + тест, `analytics.ts`, `index.ts`) — `reportWebVitals()` динамически импортирует `web-vitals`, шлёт `trackEvent('web vital: lcp'|'inp'|'cls', {value, rating})`. Вызывается один раз из `src/app/providers.tsx` вместе с `initAnalytics()`.
- **Порядок инициализации — проверено фактически на уровне исходников Sentry SDK, не предположено.** `src/main.tsx` импортирует `Providers` из `./app/providers`; `providers.tsx` импортирует `router` из `./router` до своего тела модуля, где вызывается `initSentry()`. По семантике ES-модулей статические импорты одного модуля вычисляются полностью, в порядке появления в исходном тексте, прежде чем начинает выполняться собственное тело модуля — то есть `router.tsx` (создающий роутер через `createBrowserRouter(...)`) уже выполнится к моменту, когда `providers.tsx` дойдёт до строки `initSentry()`. Это **реальный баг, не теоретический**: `node_modules/@sentry/react/build/esm/reactrouter-compat-utils/instrumentation.js` (`createV6CompatibleWrapCreateBrowserRouter`, строки ~238-244) при незаданных внутренних `_useEffect`/`_useLocation`/`_useNavigationType`/`_matchRoutes` тихо возвращает **необёрнутую** `createRouterFunction` — эти приватные поля выставляются в `setup(client)` интеграции (внутри `Sentry.init`), и предупреждение об этом спрятано за `DEBUG_BUILD` (вырезается в проде). Значит без фикса порядка обёртка `wrapCreateBrowserRouter` в проде тихо ничего не делает — ни ошибки, ни лога. См. Task 2a.
- **Роутинг** (`src/app/router.tsx`) — `createBrowserRouter` (react-router `^8.3.0`, data router API, реально экспортирует `useLocation`/`useNavigationType`/`createRoutesFromChildren`/`matchRoutes`/`createBrowserRouter` — проверено загрузкой модуля), 6 роутов под одним `AppLayout`, один параметризован (`/movie/:id`).
- **`@sentry/react` `^10.71.0` — API проверен напрямую в `node_modules`, не по внешней документации.** `reactrouterv7.d.ts` помечает `reactRouterV7BrowserTracingIntegration`/`wrapCreateBrowserRouterV7` как `@deprecated`. Актуальный API — `reactrouter.compat.d.ts`: `reactRouterBrowserTracingIntegration(options)` и `wrapCreateBrowserRouter(createRouterFunction)`, реэкспортированы из корня пакета, документированы как "Works with React Router v6+" — react-router `^8.3.0` покрыт без развилки по версии.
- **CSP** (`vercel.json`) — уже разрешает `connect-src` на Sentry ingest-хост и `api.poiskkino.dev` отдельно; включение tracing не требует новых CSP-хостов.
- **`sentry` CLI — установлен и авторизован на этой машине, все команды ниже прогнаны вживую, не по `--help` в отрыве от реальных данных:**
  - Org slug: `mycomp-ey`; project slug: `kinoshka`; team slug: `mycomp`, team id: `4512052151975936`.
  - **Грамматика target-аргумента различается по командам и по наличию завершающего слэша — проверено вживую, не по одной догадке:**
    - `sentry dashboard list mycomp-ey/ --json --fresh` — org-scoped листинг (без слэша `mycomp-ey` трактуется как glob по **заголовку** дашборда, а не как org, и почти всегда молча вернёт пустой список — это реальная ловушка, не гипотетическая: без слэша команда один раз уже вернула `{"data": []}` там, где с слэшем нашлись реальные дашборды).
    - `sentry alert issues list mycomp-ey/kinoshka --json --fresh` — project-scoped (уже нашёл существующее правило `"Send a notification for high priority issues"` при первой проверке).
    - `sentry alert metrics list mycomp-ey/ --json --fresh` — org-scoped, "project part is ignored" (подтверждено `--help`).
    - Все три list-команды поддерживают `--fresh` (обход кэша CLI) — без него список может быть устаревшим снимком, что ломает идемпотентность (пропуск нужного создания или дубль поверх уже созданного).
  - `sentry alert metrics list mycomp-ey/ --json --fresh` и `sentry dashboard list mycomp-ey/ --json --fresh` подтверждают, что **тариф поддерживает Metric Alerts и Dashboards** (не заблокировано фичами аккаунта).
  - Точные флаги `sentry alert metrics create`/`sentry dashboard create`/`sentry dashboard widget add` — задокументированы в Technical Details, взяты из живого `--help`, включая точную форму `--trigger`.
  - `.env.local` содержит `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`/`SENTRY_URL` (используются сейчас только `vite.config.ts`'s `loadEnv()`) — **`node` их не подхватывает автоматически**, provisioning-скрипту нужен явный `--env-file-if-exists` (Node `v24.13.0` его поддерживает — проверено `node --help`).
- **`.mcp.json`** — отсутствует в репозитории; Sentry remote MCP: `https://mcp.sentry.dev/mcp` (опционально `/{org}/{project}` для скоупинга).
- **`tsconfig.node.json`** — типизирует только явно перечисленные root-файлы через `include` (сейчас: `vite.config.ts`, `sentry.config.ts`, `sentry.config.test.ts`, `bundle.config.ts`, `bundle.config.test.ts`, `vercel-headers.test.ts`, `playwright.config.ts`, `e2e/**/*.ts`) и **не задаёт `types: ["vitest/globals"]`** (в отличие от `tsconfig.app.json`) — поэтому существующие root-тесты (`sentry.config.test.ts`, `vercel-headers.test.ts`) везде делают явный `import { describe, expect, it } from 'vitest'`; новые root-тесты этого плана обязаны следовать тому же стилю, иначе `make test` пройдёт, а `make typecheck` — нет.
- **Node `v24.13.0`** (`.nvmrc`) поддерживает нативный запуск `.ts`-файлов без флагов (type stripping) — `tsx` не нужен. Нюанс: при таком запуске импорт между двумя root `.ts`-файлами обязан включать расширение (`from './sentry-telemetry.config.ts'`, не `'./sentry-telemetry.config'`) — иначе `make typecheck` пройдёт (`allowImportingTsExtensions: true` это разрешает статически), но `node provision-sentry-telemetry.ts` в проде упадёт с `ERR_MODULE_NOT_FOUND` только при живом запуске, то есть уже в Post-Completion.
- **`package.json` `size-limit`** — есть отдельная запись `web-vitals` (`dist/assets/web-vitals-*.js`, 3.95 KB) — умрёт после удаления пакета. Отдельно: `sentry-bootstrap.ts` и импорт хуков `react-router` для интеграции не матчатся ни `vendor` (`/node_modules/`), ни `shared`-группой (`/\/(widgets|features|entities|shared)\//`) в `vite.config.ts`'s `codeSplitting.groups` — они лягут в **`entry`**-чанк вместе с остальным кодом `@sentry/react`'s tracing/react-router-инструментирования, который ляжет в `vendor`. Текущий замер: `dist/assets/index-*.js` ≈ 2418 B gzip при лимите `entry` 2.8 KB — запас ~380 байт, тесен для добавления пяти новых импортов и объекта `integrations`.
- **Соседний план по тому же roadmap-разделу**: `docs/plans/20260915-lighthouse-ci.md` (2.5.6) тоже правит `Makefile`/`.PHONY`/возможно `knip.jsonc` — небольшое, но реальное пересечение файлов; если оба плана исполняются в одной сессии, добавлять чекбоксы в `Makefile`/`.PHONY` по одному, не большими одновременными правками, чтобы не создавать лишние конфликты при параллельном исполнении.

## Development Approach

- **Testing approach**: Regular (код → тесты), как во всём остальном репозитории.
- Каждая задача — атомарная, со своим `Files:` блоком, тесты — отдельные чекбоксы. Task 2 из предыдущей версии плана разбита на три (2a/2b/2c) — порядок инициализации, сама tracing-интеграция и замер бюджета — это три независимых логических изменения с разным риском отката, и слишком большой единый диф плохо ревьюится (пользователь исполняет планы батчами по 3-4 задачи, см. `[[feedback_batch_planning_exec]]`).
- Где логика неизбежно внешняя — это `Post-Completion`, не чекбокс в Implementation Steps.
- Все пороговые значения (sample rate, error-rate alert, LCP threshold, дашборд-виджеты) вынесены в один тестируемый конфиг-модуль.
- Слой "alerting-as-code" сознательно минимизирован до одного конфиг-модуля + одного исполняемого скрипта.

## Testing Strategy

- **Unit-тесты**: для каждого нового/изменённого чистого модуля.
- **Root-тесты (вне `src/`) обязаны использовать явный `import ... from 'vitest'`** — `tsconfig.node.json` не задаёт `types: ["vitest/globals"]`, в отличие от `tsconfig.app.json`; иначе `make test` пройдёт, а `make typecheck` — нет.
- **Порядок инициализации — тест через чтение исходника, а не через мок-раскрутку `main.tsx`.** Пытаться импортировать `main.tsx` в тесте потребовало бы мокать `react-dom/client`/`document.getElementById('root')` (в jsdom он `null`) ради инварианта, который проще и надёжнее проверить статически — по прецеденту `vercel-headers.test.ts` (читает `index.html`, а не рендерит его): тест читает исходный текст `src/main.tsx` и утверждает, что первый `import` — `'./app/sentry-bootstrap'`.
- **Конфиг-тест `.mcp.json`** — по прецеденту `vercel-headers.test.ts`, но без тавтологии: проверяет валидный JSON + `mcpServers.sentry.type === 'http'` + `url.startsWith('https://mcp.sentry.dev/mcp')` (не точное равенство — Post-Completion разрешает локально дописать `/org/project` в конце, тест должен это переживать).
- **E2E**: не затрагиваются.
- Provisioning-скрипт вызывает внешний `sentry` CLI — юнит-тестами покрыта только чистая логика построения аргументов, exists-check и env-валидация, не сам факт создания объекта в реальном Sentry.

## Progress Tracking

- Отмечай `[x]` сразу по завершении пункта.
- ➕ для новых задач, обнаруженных по ходу.
- ⚠️ для блокеров.

## Solution Overview

Три независимых слоя:

1. **Tracing** (`sentry.config.ts` extension → `sentry-bootstrap.ts`/`main.tsx`/`sentry.ts`/`router.tsx`) — включает Sentry Performance в правильном порядке инициализации.
2. **Telemetry-as-code** (`sentry-telemetry.config.ts` + `provision-sentry-telemetry.ts` + `make sentry-telemetry`) — декларативные пороги и один provisioning-скрипт поверх `sentry` CLI.
3. **Sentry MCP** (`.mcp.json`).

Параллельно — снос старого Web Vitals→Plausible пути и раннбук для Plausible Goals.

## Technical Details

### Tracing

- **`tracesSampleRate = 0.2`** — выбрано пользователем (верхняя граница из заметки "Как лучше" в `2.5.1`, 0.1–0.2). **Честная формулировка компромисса** (первая версия этого плана содержала внутреннее противоречие "ограничитель — квота, а не трафик", исправлено): 0.2 — баланс между (а) не расходовать транзакционную квоту Sentry впустую при обычном трафике и (б) собирать достаточно сэмплов для надёжного P75. При **очень низком** трафике портфолио-проекта оба соображения могут не сойтись — в 15-минутном окне алерта может не набраться сэмплов вообще. Это принятый риск, а не решённая проблема — см. Post-Completion "тюнинг после реального трафика" (временно поднять rate или увеличить окно).
- **Отдельный, более коварный риск — не "нет данных", а "данные есть, но статистически незначимы"** (найдено внешним ревью Codex, не покрыто предыдущим пунктом): P75/`failure_rate()` по 1-2 сэмплированным точкам в окне — не "нет сигнала", а _ложный_ сигнал, который выглядит как настоящий. У Sentry Metric Alerts нет встроенного min-sample-guard для перцентильных/rate-агрегатов — CLI не даёт способа сказать "не алертить, если сэмплов меньше N". Единственная доступная митигация — операционная: держать окно достаточно широким на период soak (см. `LCP_ALERT_WINDOW_MINUTES`/`ERROR_ALERT_WINDOW_MINUTES` в Task 3, оба сознательно не заужены до 5-15 минут) и явно отслеживать историю срабатываний первые 1-2 недели, прежде чем доверять алерту без проверки глазами каждый раз.
- **`tracePropagationTargets` — НЕ передаётся в `Sentry.init` вообще**, дефолт SDK — не переопределяется. Дефолт SDK матчит только same-origin/localhost; все вызовы API идут на абсолютный кросс-origin `https://api.poiskkino.dev`, то есть заголовки `sentry-trace`/`baggage` туда и так не уйдут при дефолте — расширять список смысла нет, пока это не понадобится и не будет проверено живым запросом на CORS-совместимость стороннего API. WHY-комментарий рядом с `Sentry.init(...)` в `sentry.ts` фиксирует это.
- **API** — `Sentry.reactRouterBrowserTracingIntegration({ useEffect, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes })` + `Sentry.wrapCreateBrowserRouter(createBrowserRouter)`.
- **Порядок инициализации** — новый модуль `src/app/sentry-bootstrap.ts` вызывает `initSentry()` при вычислении собственного тела; `main.tsx` импортирует его **первой строкой**, раньше `import { Providers } from './app/providers'`. Работает благодаря порядку вычисления статических импортов ES-модулей (см. Context). Это канонический паттерн самого Sentry SDK (аналог `instrument.js`, импортируемого первым в примерах Sentry), не изобретение этого плана.
- Проверено (не входит в этот план как чекбокс, зафиксировано как факт): `oxfmt` с текущим `.oxfmtrc.json` (`sortImports: { newlinesBetween: true }`) не переставляет ведущий side-effect-импорт `./app/sentry-bootstrap` в `main.tsx` — значит `lint-staged`/`oxfmt --write` не сломает порядок автоматически. WHY-комментарий в `main.tsx` фиксирует сам порядок как требование, чтобы следующий редактор не переставил импорты вручную.

### Alerting/Dashboard-as-code (провизионится Task 3, запускается вручную в Post-Completion)

- **Org/project/team** — читаются из `SENTRY_ORG`/`SENTRY_PROJECT` (`process.env`, загружаются через `node --env-file-if-exists=.env.local`), team резолвится динамически через `sentry team list <org>/ --json --fresh` в момент запуска (чтобы не протухнуть, если команда в Sentry когда-нибудь переименуется/пересоздастся). Скрипт **fail-fast**, если `SENTRY_ORG`/`SENTRY_PROJECT` после загрузки `.env.local` всё ещё не заданы — понятная ошибка вместо `undefined` в argv (по прецеденту `vercel-headers.test.ts`: "broken config throws a clear error rather than an opaque undefined").
- **Точные list-команды для idempotency-проверки (см. Context — грамматика target проверена вживую):**
  - `sentry alert issues list <org>/<project> --json --fresh` — существующие issue alert rules.
  - `sentry alert metrics list <org>/ --json --fresh` — существующие metric alert rules.
  - `sentry dashboard list <org>/ --json --fresh` — существующие дашборды.
- **Error rate alert (Metric Alert, `failure_rate()` — см. "Принятые решения" про две предыдущие итерации этого выбора):** `sentry alert metrics create <org> --name '<name>' --query '' --aggregate 'failure_rate()' --dataset transactions --time-window <ERROR_ALERT_WINDOW_MINUTES> --project <project> --trigger '[{"alertThreshold":<ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT>,"actions":[{"id":"sentry.mail.actions.NotifyEmailAction","targetType":"Team","targetIdentifier":<teamId>}]}]'` — форма `--trigger`/флагов дословно из живого `sentry alert metrics create --help`; `failure_rate()` как валидный агрегат для `transactions`-датасета подтверждён поиском (доля транзакций со статусом ≠ ok/cancelled/unknown), но **числовой масштаб порога (0-100 vs 0-1) не подтверждён живым вызовом** — нащупать в Task 3 до хардкода значения в конфиг (см. чекбокс ниже), не предполагать.
- **LCP P75 alert:** `sentry alert metrics create <org> --name '<name>' --query '' --aggregate 'p75(measurements.lcp)' --dataset transactions --time-window <LCP_ALERT_WINDOW_MINUTES> --project <project> --trigger '[{"alertThreshold":<LCP_P75_THRESHOLD_MS>,"actions":[{"id":"sentry.mail.actions.NotifyEmailAction","targetType":"Team","targetIdentifier":<teamId>}]}]'`.
- **Dashboard "Kinoshka Telemetry"** — 6-колоночная сетка (ширины виджетов по типу зафиксированы в `sentry dashboard widget add --help`: `big_number` 2×1, `line`/`area`/`bar` 3×2, `table` 6×2 — сумма ширин в строке должна быть 6, иначе CLI молча авто-разложит иначе): строка из 3 `big_number` (failure rate `--dataset transactions --query failure_rate`, issues count, throughput) + `line`-график P75 LCP (`--dataset transactions --query p75:measurements.lcp`) + `table` топ issues (full-width, `--dataset issue`). **INP/CLS как виджеты дашборда — датасет требует живой проверки после того, как в проекте реально появятся ingested-данные** (в SDK v8+ INP, а в v9/v10 и CLS — standalone span, не measurement на транзакции; вероятный датасет — `spans`, не `transactions`, но не предполагается заранее). Roadmap просит алерт только на LCP — на INP/CLS алертов нет, только видимость на дашборде.
- **"Idempotency" здесь — терминологически неточное слово, если понимать его строго** (уточнение по внешнему ревью Codex): скрипт реализует **create-if-missing**, не полную синхронизацию состояния. Exists-check по имени в соответствующем list-выводе (`--fresh`, см. выше); если существует — пропуск создания, предупреждение в stdout. Если после первого запуска поменять пороги в `sentry-telemetry.config.ts` (например, `LCP_P75_THRESHOLD_MS`) и перезапустить скрипт — существующее правило **не обновится**, скрипт просто увидит совпадение по имени и пропустит его молча. Обновление порогов/виджетов у уже существующих объектов — ручной путь (`sentry alert metrics edit`/`sentry dashboard widget edit`/`widget delete`), сознательно не автоматизировано в этом плане, чтобы не городить diff-логику ради одноразового provisioning. **Для виджетов** конкретно — если дашборд уже существует, скрипт не трогает виджеты вообще (ни создаёт заново, ни диффует).
- **`.mcp.json`** — `{ "mcpServers": { "sentry": { "type": "http", "url": "https://mcp.sentry.dev/mcp" } } }`.

## What Goes Where

- **Implementation Steps** — код (tracing-конфиг, provisioning-скрипт, `.mcp.json` + тест, снос web-vitals-пайплайна), тесты, обновление документации.
- **Post-Completion** — живой запуск provisioning-скрипта против реального Sentry, живая проверка трейсов/группировки роутов, настройка Plausible Goals в UI, OAuth Sentry MCP, будущее решение по `tracePropagationTargets`, тюнинг sample rate/окна алерта после реального трафика.

## Implementation Steps

### Task 1: Порог sample rate в `sentry.config.ts`

**Files:**

- Modify: `sentry.config.ts`
- Modify: `sentry.config.test.ts`

- [x] добавить `export const SENTRY_TRACES_SAMPLE_RATE = 0.2` с WHY-комментарием про trade-off квота/данные-для-P75 (см. Technical Details — без внутреннего противоречия "это только про квоту")
- [x] написать тест: `SENTRY_TRACES_SAMPLE_RATE === 0.2`
- [x] прогнать тесты — должны пройти перед Task 2a

### Task 2a: Исправить порядок инициализации Sentry относительно роутера

**Files:**

- Create: `src/app/sentry-bootstrap.ts`
- Create: `src/app/sentry-bootstrap.test.ts`
- Create: `src/main.test.ts` (см. Testing Strategy — тест читает исходник, не рендерит `main.tsx`)
- Modify: `src/main.tsx`
- Modify: `src/app/providers.tsx`
- Modify: `src/app/providers.test.tsx`

- [x] создать `src/app/sentry-bootstrap.ts`: импортирует `initSentry` из `./sentry` и вызывает его на верхнем уровне модуля, с WHY-комментарием, объясняющим требование порядка (см. Technical Details/Context — реальный тихий баг в `reactrouter-compat-utils`, а не гипотетический)
- [x] добавить `import './app/sentry-bootstrap'` первой строкой в `src/main.tsx`, раньше `import { Providers } from './app/providers'`, с WHY-комментарием прямо у этой строки (следующий редактор может переставить импорты не глядя)
- [x] убрать `initSentry` импорт/вызов из `src/app/providers.tsx` (переехал в `sentry-bootstrap.ts`) — `initAnalytics()` остаётся
- [x] написать тест на `sentry-bootstrap.ts`: мокнуть `./sentry`, убедиться, что `initSentry` вызван ровно один раз при импорте модуля
- [x] написать `src/main.test.ts`: прочитать исходный текст `src/main.tsx` (`fs.readFileSync`), убедиться, что первый `import`-путь в файле — `'./app/sentry-bootstrap'`
- [x] обновить `providers.test.tsx` — убрать тест/мок `initSentry` (он больше не импортируется из `providers.tsx`)
- [x] прогнать тесты — должны пройти перед Task 2b

### Task 2b: Включить Sentry Performance tracing (integrations + router wrap)

**Files:**

- Modify: `src/app/sentry.ts`
- Modify: `src/app/sentry.test.ts`
- Modify: `src/app/router.tsx`
- Modify: `src/app/router.test.tsx`

- [x] обернуть `createBrowserRouter(...)` в `router.tsx` через `Sentry.wrapCreateBrowserRouter`
- [x] добавить в `Sentry.init(...)` (`sentry.ts`): `integrations: [Sentry.reactRouterBrowserTracingIntegration({ useEffect, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes })]`, `tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE` — **`tracePropagationTargets` не добавлять**
- [x] обновить мок `vi.mock('@sentry/react', ...)` в `sentry.test.ts`, добавив `reactRouterBrowserTracingIntegration`/`wrapCreateBrowserRouter` как `vi.fn()`
- [x] обновить тест "Sentry.init вызван с ожидаемым конфигом" — добавить `integrations`/`tracesSampleRate` в ожидаемый объект, добавить отдельный тест-регрессию "`tracePropagationTargets` НЕ присутствует среди ключей вызова"
- [x] обновить `router.test.tsx`, если обёртка `wrapCreateBrowserRouter` меняет поведение рендера роутов (успешный кейс — роутинг работает как раньше) — не потребовалось: без `Sentry.init()` (PROD=false в тестах) `wrapCreateBrowserRouter` возвращает необёрнутую функцию, `router.test.tsx` прошёл без изменений
- [x] прогнать тесты — должны пройти перед Task 2c

### Task 2c: Перемерить бюджеты `size-limit` после включения tracing

**Files:**

- Modify: `package.json` (`size-limit`, записи `entry` и `vendor`)

- [x] собрать `make build-only`
- [x] перемерить gzip-размер `dist/assets/index-*.js` (`entry`) и `dist/assets/vendor-*.js` (`vendor`) — оба чанка получают новый код (react-router-хуки/`sentry-bootstrap.ts` → `entry`, `@sentry/react`'s tracing-инструментирование → `vendor`, см. Context). Измерено через `pnpm exec size-limit` (та же метрика, что и проверяющая команда): `entry` 2.52 kB gzip, `vendor` 160.61 kB gzip.
- [x] обновить `limit` обеих записей в `package.json`'s `"size-limit"` по правилу measured+15% (см. AGENTS.md 2.5.3) — `entry`: 2.52 × 1.15 ≈ 2.9 KB; `vendor`: 160.61 × 1.15 ≈ 184.7 KB
- [x] прогнать `make size` — должен пройти перед Task 3

### Task 3: Telemetry-as-code — пороги, argv-builders, provisioning-скрипт

**Files:**

- Create: `sentry-telemetry.config.ts`
- Create: `sentry-telemetry.config.test.ts`
- Create: `provision-sentry-telemetry.ts`
- Create: `provision-sentry-telemetry.test.ts`
- Modify: `Makefile` (новый target `sentry-telemetry` + добавить его в `.PHONY`)
- Modify: `tsconfig.node.json` (добавить все четыре новых root-файла в `include`)
- Modify: `knip.jsonc` (добавить `sentry-telemetry.config.ts` и `provision-sentry-telemetry.ts` в `entry` — тестовые файлы уже покрыты существующим глобом `**/*.test.{ts,tsx}`)

- [x] прогнать `sentry alert metrics create <org> --name '__probe__' --query '' --aggregate 'failure_rate()' --dataset transactions --time-window 60 --project <project> --trigger '[{"alertThreshold":5,...}]' --dry-run` и (если `--dry-run` не валидирует удалённо — см. WHY-комментарий рядом, основано на наблюдении в Context, что `--dry-run` у `alert issues create` не бьёт по серверу) при необходимости создать/удалить тестовое правило, чтобы подтвердить: (а) числовой масштаб `alertThreshold` для `failure_rate()` (0-100 vs 0-1), (б) что `--query ''` (без фильтра) валиден для этого агрегата — зафиксировать находки в комментарии у `ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT` — живой пробный вызов проведён (org `mycomp-ey`/project `kinoshka`, sentry CLI 0.44.1, 2026-09-16): (б) подтверждено однозначно — `--query ''` невалидна (`--dry-run` бьёт по клиентской валидации CLI мгновенно: "Error: query cannot be empty."), билдеры используют непустой `METRIC_ALERT_QUERY = 'event.type:transaction'`. (а) НЕ подтверждено живым созданием — обнаружен более глубокий блокер: реальное (non-dry-run) создание на `--dataset transactions` отклоняется сервером целиком ("Creation of transaction-based alerts is disabled, as we migrate to the span dataset..."), а единственная альтернатива, которую принимает клиентская валидация CLI (`--dataset spans`), не мапится в ожидаемый сервером `eventsanalyticsplatform`/`performancemetrics` ("Invalid dataset for this query type"). `ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT` оставлен как документированное best-effort-допущение (0-100 шкала, по прецеденту публичной Sentry-документации для процентных aggregate), с явным WHY-комментарием и флагом "требует живой проверки в Post-Completion" — см. новый подраздел в Post-Completion. Ни один пробный вызов не создал реальный объект (все падали на 400/клиентской валидации до персиста) — подтверждено повторным `sentry alert metrics list mycomp-ey/ --json --fresh` → `{"data":[]}`, убирать нечего. Полный лог команд — в прогресс-файле задачи.
- [x] `sentry-telemetry.config.ts`: `ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT = 5`, `ERROR_ALERT_WINDOW_MINUTES = 60`, `LCP_P75_THRESHOLD_MS = 2500`, `LCP_ALERT_WINDOW_MINUTES = 60` (оба окна подняты с изначальных 15 минут — см. Technical Details, "данные есть, но статистически незначимы")
- [x] `sentry-telemetry.config.ts`: `DASHBOARD_WIDGETS` — типизированный массив спецификаций виджетов (name, display, dataset, query, col/row/width/height); датасет/query для INP/CLS виджетов помечен `TODO: подтвердить после появления ingested-данных`
- [x] `sentry-telemetry.config.ts`: `type TelemetryContext = { org: string; project: string; teamId: string }`; чистые функции `buildErrorRateMetricAlertArgs(ctx, config)`, `buildLcpMetricAlertArgs(ctx, config)`, `buildDashboardCreateArgs(ctx, title)`, `buildWidgetArgs(ctx, dashboardTitle, widget)` — каждая возвращает `string[]` (argv)
- [x] `sentry-telemetry.config.ts`: `buildIssueAlertListArgs(ctx)`, `buildMetricAlertListArgs(ctx)`, `buildDashboardListArgs(ctx)` — argv для трёх `--json --fresh` list-вызовов, с точной грамматикой target (см. Technical Details — `<org>/<project>` для issues, `<org>/` для metrics/dashboard)
- [x] `sentry-telemetry.config.ts`: `shouldCreate(existingNames: string[], desiredName: string): boolean` — простая exists-проверка (`!existingNames.includes(desiredName)`)
- [x] `provision-sentry-telemetry.ts`: `validateEnv()` — читает `process.env.SENTRY_ORG`/`SENTRY_PROJECT`, кидает понятную ошибку, если пусто
- [x] `provision-sentry-telemetry.ts`: эффектная `main()` — `validateEnv()` → резолвит team через `sentry team list <org>/ --json --fresh` → для error-rate alert / LCP alert / dashboard (+виджеты, только если дашборд создаётся впервые) — `sentry ... list --json --fresh` → `shouldCreate` → при true `child_process.execFileSync('sentry', buildXArgs(...), { stdio: 'inherit' })`; импорты между root `.ts`-файлами — с явным расширением `.ts` (см. Context)
- [x] добавить `sentry-telemetry` в `Makefile`: `node --env-file-if-exists=.env.local provision-sentry-telemetry.ts`, с комментарием, что требует предварительного `sentry auth login` (на этой машине уже выполнено); добавить `sentry-telemetry` в `.PHONY`
- [x] написать тесты для всех `buildXArgs`/`buildXListArgs` функций (успешный кейс — ожидаемый argv на фиксированной тестовой `TelemetryContext`, включая точный target с завершающим слэшем там, где он нужен)
- [x] написать тест на `DASHBOARD_WIDGETS`: сумма `width` виджетов в каждой строке сетки равна 6, размеры соответствуют типу `display` (`big_number` 2×1, `line` 3×2, `table` 6×2)
- [x] написать тесты для `shouldCreate` (успех: имени нет в списке → `true`; edge: имя уже есть → `false`)
- [x] написать тест для `validateEnv()` (edge: `SENTRY_ORG`/`SENTRY_PROJECT` не заданы → понятная ошибка, не `undefined` в argv дальше по цепочке)
- [x] прогнать тесты — должны пройти перед Task 4

### Task 4: Sentry MCP в `.mcp.json`

**Files:**

- Create: `.mcp.json`
- Create: `mcp-config.test.ts`
- Modify: `README.md`
- Modify: `tsconfig.node.json` (добавить `mcp-config.test.ts` в `include`)

- [ ] создать `.mcp.json` в корне репо с `mcpServers.sentry = { type: 'http', url: 'https://mcp.sentry.dev/mcp' }`
- [ ] написать `mcp-config.test.ts` — читает `.mcp.json`, парсит JSON, проверяет `mcpServers.sentry.type === 'http'` и `mcpServers.sentry.url.startsWith('https://mcp.sentry.dev/mcp')` (не точное равенство — переживает локальный org/project-скоуп из Post-Completion)
- [ ] добавить в `README.md` короткую заметку: после клонирования репозитория Claude Code предложит авторизовать Sentry MCP через OAuth; опционально можно локально сузить URL до `/mycomp-ey/kinoshka`, не коммитя это изменение
- [ ] прогнать тесты — должны пройти перед Task 5

### Task 5: Снести Web Vitals→Plausible пайплайн (заменён Sentry Performance)

**Files:**

- Delete: `src/shared/lib/analytics/reportWebVitals.ts`
- Delete: `src/shared/lib/analytics/reportWebVitals.test.ts`
- Modify: `src/shared/lib/analytics/index.ts`
- Modify: `src/shared/lib/analytics/analytics.ts`
- Modify: `src/shared/lib/index.ts`
- Modify: `src/app/providers.tsx`
- Modify: `src/app/providers.test.tsx`
- Modify: `package.json` (удалить зависимость `web-vitals`, удалить `size-limit`-запись `web-vitals`)
- Modify: `vite.config.ts` (удалить `web-vitals` group из `codeSplitting.groups`)

- [ ] удалить `reportWebVitals.ts` и его тест
- [ ] убрать `export { reportWebVitals } from './reportWebVitals'` из `src/shared/lib/analytics/index.ts`, поправить вводный комментарий модуля (он объясняет реэкспорт через единственного потребителя, которого больше нет)
- [ ] убрать реэкспорт `reportWebVitals` из публичного барела `src/shared/lib/index.ts`
- [ ] убрать вызов `reportWebVitals()` и его импорт из `src/app/providers.tsx`
- [ ] обновить комментарий про очередь `.q` в `analytics.ts` — убрать упоминание "ранние web-vitals (LCP) терялись бы", оставить только обоснование про `trackPageview()`
- [ ] снять `export` с `isAnalyticsEnabled` в `analytics.ts`, если после удаления `reportWebVitals.ts` у неё не остаётся кросс-файловых потребителей (по прецеденту AGENTS.md 2.5.3 — "снимать лишний `export`, а не заводить knip-ignore")
- [ ] `pnpm remove web-vitals`
- [ ] удалить запись `web-vitals` из `package.json`'s `"size-limit"` массива
- [ ] удалить `{ name: 'web-vitals', test: /node_modules\/web-vitals\// }` группу из `vite.config.ts`'s `codeSplitting.groups`
- [ ] обновить `providers.test.tsx` — переименовать `it('вызывает initAnalytics и reportWebVitals...')` в `it('вызывает initAnalytics...')`, убрать `reportWebVitals` из ассертов и из `vi.mock('@shared/lib', ...)`
- [ ] прогнать `make test` и `make typecheck` — не должно остаться dangling-импортов на `reportWebVitals`/`web-vitals`
- [ ] прогнать тесты — должны пройти перед Task 6

### Task 6: Раннбук для Plausible Custom Goals (конверсия по flows)

**Files:**

- Create: `docs/telemetry-runbook.md`

- [ ] задокументировать точные имена Custom Goals в Plausible UI для уже существующих событий (`pageview`, `search submitted`, `filter changed`, `favorite added`)
- [ ] задокументировать пример funnel'а "конверсия по ключевому flow" (например: `pageview` → `search submitted` → `favorite added`) — с оговоркой, что funnels могут быть платной фичей тарифа
- [ ] задокументировать установку/авторизацию `sentry` CLI (`curl https://cli.sentry.dev/install -fsS | bash`, `sentry auth login`) и команду `make sentry-telemetry`
- [ ] задокументировать решение про `tracePropagationTargets` (что не включено и при каком условии можно включить)

### Task 7: Verify acceptance criteria

- [ ] прогнать полный набор тестов: `make test`
- [ ] прогнать `make check` (lint + build)
- [ ] прогнать `make size`
- [ ] прогнать `make knip`
- [ ] сверить итоговый `provision-sentry-telemetry.ts` с реальными `--help`-выводами команд, использованных в Task 3 — убедиться, что ничего не разошлось за время работы над остальными задачами

### Task 8: [Final] Обновить документацию

- [ ] переписать раздел "Web Vitals + Analytics" в `AGENTS.md` — убрать всё про `reportWebVitals`/пакет `web-vitals`/события `web vital: *`, оставить только Plausible-часть
- [ ] в разделе "Performance budgets + bundle visualization" `AGENTS.md` — убрать упоминание `web-vitals`-группы в `codeSplitting.groups` и её `size-limit`-записи (обе удалены Task 5)
- [ ] в таблице "Key public APIs" `AGENTS.md` — убрать строку/упоминание `reportWebVitals()` из `@shared/lib`
- [ ] добавить в `AGENTS.md` новый раздел "Telemetry дашборд (Sentry)" — задокументировать: `tracesSampleRate=0.2` и его trade-off (включая риск статистически незначимой выборки, не только "нет данных"), решение про `tracePropagationTargets`, пороги error-rate (`failure_rate()`)/LCP-алертов и историю отказа от Issue Alert → count-based → `failure_rate()`, состав дашборда, create-if-missing (не полная синхронизация) подход provisioning-скрипта, `.mcp.json`/Sentry MCP, порядок инициализации через `sentry-bootstrap.ts`, ссылку на `docs/telemetry-runbook.md`
- [ ] отметить `[x]` в `plans/roadmap.md` под `2.5.7`, с заметкой про отклонение от буквальной формулировки: Web Vitals переехали в Sentry, добавлен Sentry MCP сверх формулировки, error-rate реализован как `failure_rate()` Metric Alert на `transactions`-датасете (после промежуточного и отвергнутого count-based варианта — не Issue Alert по уникальным пользователям), третий пункт ("конверсия по flows") закрыт раннбуком/ручной настройкой Plausible UI
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

_Пункты, требующие ручных действий или внешних систем — без чекбоксов, информационно._

**Ручной запуск против реального Sentry:**

- `make sentry-telemetry` — реально создаёт Metric Alert (error rate), Metric Alert (LCP P75) и Dashboard "Kinoshka Telemetry" в проде (`sentry auth login` на этой машине уже выполнен).
- Живая проверка: `make build-only` + `pnpm exec vite preview` с реальным `VITE_SENTRY_DSN` из `.env.local`, несколько перезагрузок `/` и `/movie/:id` (сэмплирование 20% — возможно, потребуется несколько попыток), затем `sentry trace list mycomp-ey/kinoshka` — убедиться, что транзакция называется `/movie/:id`, а не `/movie/123`. Эта сборка создаёт настоящий Sentry release и заливает source maps (в `.env.local` уже есть `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`) — намеренно не делается в рамках Implementation Steps.
- Глазами проверить итоговый дашборд/алерты в Sentry UI.

**Plausible:**

- Настроить Custom Goals + funnel по `docs/telemetry-runbook.md` в Plausible UI.

**Sentry MCP:**

- При следующем запуске Claude Code в этом репозитории — пройти OAuth-авторизацию Sentry MCP.
- Опционально: локально (не в коммите) заменить URL в `.mcp.json` на скоупленный `https://mcp.sentry.dev/mcp/mycomp-ey/kinoshka`.

**⚠️ Критическая находка живого пробного вызова (Task 3, 2026-09-16) — блокирует реальный запуск `make sentry-telemetry` до разбора:**

- `sentry alert metrics create --dataset transactions` для этого аккаунта **отклоняется сервером
  целиком** при реальном (не `--dry-run`) создании — независимо от aggregate/query/alertThreshold:
  `"Creation of transaction-based alerts is disabled, as we migrate to the span dataset. Create
  span-based alerts (dataset: events_analytics_platform) with the is_transaction:true filter
  instead."` Установленная версия `sentry` CLI (0.44.1) не принимает `events_analytics_platform`
  как значение `--dataset` вообще (клиентская валидация ограничивает список: errors, transactions,
  sessions, events, spans, metrics), а ближайшая альтернатива `--dataset spans` даёт другую ошибку
  сервера ("Invalid dataset for this query type. Valid datasets are ['eventsanalyticsplatform',
  'performancemetrics', 'transactions']"). Итог: **нет ни одного значения `--dataset`, доступного в
  этой версии CLI, которым реально можно создать этот тип алерта на этом аккаунте.**
- Отдельно: payload, который сервер реально ожидает для триггеров, шире документированного в
  `--help`/примерах `{"alertThreshold":X,"actions":[...]}` — экспериментально потребовались
  `type`/`comparison`/`conditionResult` плюс обязательное второе ("resolve") условие. Похоже,
  аккаунт уже переведён на новый unified Detector/workflow-engine формат, а CLI 0.44.1
  документирован по старому.
- Из-за этого числовой масштаб `ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT`
  (`sentry-telemetry.config.ts`) — **best-effort допущение** (0-100 шкала, не 0-1), не
  подтверждённое живым созданием (сервер отбрасывает запрос раньше, на этапе выбора датасета).
  Полный лог пробных команд — в прогресс-файле задачи ("task 3").
- **Перед реальным запуском `make sentry-telemetry` нужно решить одно из:** (а) обновить `sentry`
  CLI до версии, поддерживающей `events_analytics_platform`/`eventsanalyticsplatform` как
  `--dataset`, и обновить `sentry-telemetry.config.ts` под неё; (б) создать оба Metric Alert'а
  вручную через Sentry UI, затем `sentry alert metrics view <org>/<name>` — прочитать реальный
  сохранённый `alertThreshold`, подтвердив шкалу, и обновить провижининг-скрипт под фактически
  работающий payload; (в) дождаться, пока Sentry снова разрешит создание алертов на
  `dataset: transactions` через API. Ни один из вариантов не был выбран здесь — сознательно, так
  как выбор зависит от того, что окажется быстрее/доступнее на момент реального запуска.

**Тюнинг после реального трафика (не в рамках этого плана):**

- Если в течение 1-2 недель LCP/error-rate алерты ни разу не сработали/не накопили данных из-за низкого трафика × 20%-сэмплирования — пересмотреть `tracesSampleRate` (временно поднять) или окна алертов (`LCP_ALERT_WINDOW_MINUTES`/`ERROR_ALERT_WINDOW_MINUTES`).
- **Отдельно от "нет данных" — проверить, не срабатывают ли алерты ложно на статистически незначимой выборке** (1-2 сэмпла в окне дают "P75"/"failure rate", не отражающие реальную картину): первые 1-2 недели каждое срабатывание проверять глазами в Sentry UI (реальные сэмплы за окном), а не доверять email-уведомлению как есть.
- **Проверить `failure_rate()` на реальных данных**: если после нескольких дней реального трафика с реальными JS-ошибками метрика стабильно читается как `0` (см. риск в Technical Details — браузерный SDK может не флипать статус транзакции так же, как серверные SDK на HTTP-кодах), заменить error-rate алерт на явно переименованный "error count" Metric Alert (`count()` на `errors`-датасете) — не оставлять молчаливо неработающую rate-метрику.
- Если понадобится distributed tracing до `api.poiskkino.dev` — сначала живым запросом проверить `Access-Control-Allow-Headers` стороннего API на `sentry-trace`/`baggage`, и только потом добавлять `tracePropagationTargets` в `sentry.config.ts`.
