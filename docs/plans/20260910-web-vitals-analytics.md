# Web Vitals + Analytics (роадмап 2.5.2)

## Overview

Реализовать пункт `2.5.2` из `plans/roadmap.md:401-408`: мониторинг Core Web Vitals
(LCP/INP/CLS) и минимальный event tracking (page view, search submitted, filter changed,
favorite added), отправляемые в privacy-friendly аналитику.

**Архитектурное решение (зафиксировано с пользователем):**

- **Web Vitals → `web-vitals` → Plausible**, не Sentry Performance. `2.5.1` (уже реализован,
  `docs/plans/completed/20260905-sentry-error-tracking.md`) намеренно ограничил скоуп Sentry
  только error tracking — включение `browserTracingIntegration`/`tracesSampleRate` потребовало
  бы `reactRouterBrowserTracingIntegration` из-за параметризованного `/movie/:id` (иначе каждый
  фильм — своя transaction). Пакет `web-vitals` (обёртка над `PerformanceObserver`) избегает
  этого целиком — он не знает о роутах вообще, просто измеряет метрики страницы.
- **Аналитика → Plausible**, не PostHog. Privacy-first, без cookie-баннера, минимальный
  setup-overhead (один script-тег + `window.plausible()` для custom events) — соответствует
  формулировке роадмапа ("для портфолио privacy-friendly стек выглядит зрелее").

Скоуп: сбор и отправка метрик/событий. Создание Plausible-сайта, реальный `data-domain` и
включение custom-event голов в Plausible dashboard — Post-Completion (внешняя система, как
`SENTRY_AUTH_TOKEN` в 2.5.1).

## Context (from discovery)

- `src/app/sentry.ts` / `src/app/providers.tsx` — прямой прецедент для формы этого модуля:
  явная `init*()`-функция (не side-effect при импорте, чтобы быть тестируемой через
  `vi.stubEnv`), с гейтом `import.meta.env.PROD && <credential>`, вызывается один раз на
  верхнем уровне модуля в `providers.tsx` до определения `Providers`.
- `src/shared/lib/` — каждый модуль (`debounce/`, `sessionCache/`, `storage/`, `viewport/`) это
  директория с `index.ts` + реализацией + `*.test.ts`, ре-экспортированная из
  `src/shared/lib/index.ts`. Роадмап называет файл `src/shared/lib/analytics.ts` (плоский путь,
  см. `plans/roadmap.md:1007`), но реализация следует уже устоявшейся директорийной
  конвенции — тот же осознанный отход от буквальной формулировки роадмапа, что был у
  `useRecommendedMovies` (см. `AGENTS.md`, "Naming: `useRecommendedMovies`, не
  `useRecommendations`").
- `src/vite-env.d.ts` — сейчас единственная строка `declare const __APP_RELEASE__: string`, без
  единого `import`/`export` (ambient-файл). Новый глобальный тип `window.plausible` добавляется
  сюда же той же декларацией `interface Window { ... }`.
- **Точки интеграции для четырёх событий** (см. `AGENTS.md`, разделы Routing/Data state):
  - **page view** — `src/app/layouts/AppLayout.tsx`. Единственный layout-компонент, через
    который проходят все 6 роутов (`src/app/router.tsx`), уже вызывает `useLocation()`.
    Трекать на смену `location.pathname` (не полного `location.key`/`search`) — иначе
    debounce-запись `?q` в `Header` (`QUERY_DEBOUNCE_MS`) или клики по фильтрам на `/search`
    спамили бы pageview на каждое изменение URL-параметров внутри одной и той же страницы.
  - **search submitted** — нет единой точки "submit": `HeroSection` (`/`) шлёт на явный Enter/
    клик, `Header` пишет `?q` живьём по дебаунсу без дискретного submit-события (см. `AGENTS.md`,
    "Shared «search → URL» contract"). Общая для обоих точка — сам `Search.tsx`
    (`src/pages/search/ui/Search/Search.tsx:184`, `query = searchParams.get('q')`), куда
    debounce-committed `?q` приходит независимо от источника. Трекать по transition-ref
    паттерну, уже использованному в `usePageSync.ts` (`src/pages/search/model/usePageSync.ts`) —
    сравнение с предыдущим значением через `useRef`, а не на каждый рендер. **Дополнительно**:
    `Header`'s дебаунс всего 250мс, поэтому набор одного слова коммитит в `?q` несколько
    промежуточных непустых значений подряд — голый transition-ref затрекал бы каждое как
    отдельный submit. `useSearchAnalytics` (Task 6) сверху накладывает свой, более долгий
    `useDebouncedValue` (800мс) перед сравнением через реф.
  - **filter changed** — `useFilterState.ts` (`src/features/catalog-filter/model/useFilterState.ts`),
    единственная точка коммита фильтров в URL — `applyFilters` (вызывается из `setFilters`/
    `toggleGenre`/сброса года/рейтинга). `setSort` — отдельная функция, роадмап её не упоминает
    в списке из четырёх событий → не трекается.
  - **favorite added** — `useFavorites.ts` (`src/features/favorites/model/useFavorites.ts`).
    `add()` не имеет ни одного вызывающего в `.tsx` (проверено: `grep -rn "\.toggle(\|
    onToggleFavorite" src`), реальная точка добавления в избранное — ветка `toggle()`, где id
    ещё не было в списке. Трекать именно там, не в `add()`.
- Ни одна из этих четырёх точек не лежит в `@entities`/`@features`, которым нельзя импортировать
  вверх, кроме `useFilterState`/`useFavorites` — оба легально импортируют `@shared/lib` вниз по
  FSD (`features → shared`). `AppLayout`/`Search.tsx` — уже `app`/`pages`-слой, импорт вниз тоже
  легален.
- `.env.local`/`.env.example` — уже содержат `VITE_SENTRY_DSN`/`SENTRY_*` как
  плейсхолдеры (2.5.1). Новая переменная `VITE_PLAUSIBLE_DOMAIN` добавляется по тому же
  образцу.

## Development Approach

- **Testing approach**: Regular (код → тесты), по образцу `docs/plans/completed/
  20260905-sentry-error-tracking.md`.
- Каждая задача завершается полным набором тестов и `make test` перед переходом к следующей.
- `pnpm exec tsc -b` как реальный typecheck-гейт (не `make typecheck` — см. `AGENTS.md`,
  раздел "Sentry", про solution-style `tsconfig.json`; на момент этого плана `make typecheck`
  уже исправлен на `tsc -b`, но `pnpm exec tsc -b` остаётся явной проверкой на каждом шаге).

## Testing Strategy

- **Unit-тесты** обязательны для каждой задачи: `initAnalytics`/`trackEvent`/`trackPageview`
  через `vi.stubEnv`, `reportWebVitals` через `vi.mock('web-vitals')`, интеграционные точки
  (`AppLayout`, `useSearchAnalytics`, `useFilterState`, `useFavorites`) через
  `vi.mock('@shared/lib', ...)` с сохранением остальных реальных экспортов
  (`vi.importActual`).
- E2E-тестов в проекте нет (Playwright — роадмап `2.5.2`'s соседний пункт `e2e/{...}.spec.ts`
  в Phase 2.5, но ещё не заведён) — вне скоупа этого плана.

## Progress Tracking

- Отмечать `[x]` сразу по завершении пункта.
- Новые обнаруженные задачи — префикс ➕, блокеры — ⚠️.

## Solution Overview

`src/shared/lib/analytics/` — новый модуль, три файла:

- **`analytics.ts`** — `isAnalyticsEnabled()`, `initAnalytics()` (ставит Plausible's queue-stub
  на `window.plausible` **синхронно**, затем инжектит `script.manual.js` в `<head>`, прод-only +
  `VITE_PLAUSIBLE_DOMAIN` обязателен — тот же гейт, что `initSentry`), `trackEvent(name,
  props?)`, `trackPageview()`. `.manual.js`-вариант Plausible-скрипта отключает автоматический
  pageview/outbound-tracking — вместо этого `trackPageview()` дергает `window.plausible(
  'pageview')` явно на каждую смену роута (SPA-стандартный паттерн для Plausible, без него
  сработал бы только первый заход). Queue-stub гарантирует, что вызовы `trackEvent`/
  `trackPageview` до фактической загрузки скрипта не теряются, а складываются в
  `window.plausible.q` и доотправляются самим скриптом при загрузке — без стаба самый первый
  pageview каждой сессии (и ранний LCP) терялся бы почти всегда, т.к. динамически вставленный
  `<script>` выполняется асинхронно независимо от `defer`.
- **`reportWebVitals.ts`** — `reportWebVitals()`, динамически импортирует `web-vitals`
  (`await import('web-vitals')`, не статический импорт — не тянуть пакет в основной чанк ради
  одной прод-only точки вызова) и подписывается на `onLCP`/`onINP`/`onCLS`, каждый callback шлёт
  `trackEvent('web vital: <name>', { value, rating })` (имя события в нижнем регистре —
  единообразно с остальными тремя событиями, см. ниже). CLS домножается на 1000 перед
  округлением (общепринятая практика — сырое значение CLS унитless-дробь вроде `0.05`, `*1000`
  даёт целое число, удобное для Plausible custom-event props). **Принятое ограничение**: ни
  `web-vitals`, ни этот план не используют `navigator.sendBeacon` — `onCLS`/`onINP` (и часто
  `onLCP`) обычно срабатывают на `visibilitychange`/page-hide, когда обычный XHR/fetch-запрос
  Plausible-скрипта может быть отменён браузером при закрытии вкладки. Это известная просадка
  доставки поздних vitals-метрик, а не баг; фикс (доставка через `sendBeacon`) — вне скоупа
  этого плана, т.к. зависит от внутреннего механизма самого Plausible-скрипта, а не от кода
  здесь.
- **`index.ts`** — ре-экспорт `initAnalytics`, `trackEvent`, `trackPageview`,
  `reportWebVitals`, `isAnalyticsEnabled` (последняя — только для внутреннего использования
  `reportWebVitals.ts` внутри того же модуля, не реэкспортируется из публичного `@shared/lib`,
  см. Task 2).

`initAnalytics()` и `reportWebVitals()` вызываются один раз на верхнем уровне `providers.tsx`,
рядом с `initSentry()`. Точечные события (page view / search submitted / filter changed /
favorite added) вызывают `trackEvent`/`trackPageview` напрямую из соответствующих
хуков/компонентов (см. Context выше) — без отдельного event-bus/middleware, т.к. интеграционных
точек всего четыре и они уже физически разнесены по своим владеющим модулям.

## Technical Details

`window.plausible` в проде **синхронно** определена сразу после `initAnalytics()` — как
queue-stub-функция, которую сама `initAnalytics()` ставит на `window` до вставки `<script>`
(см. Task 2). Реальный скрипт `plausible.io/js/script.manual.js` подгружается асинхронно и,
загрузившись, заменяет стаб на настоящую реализацию и доотправляет всё, что накопилось в
`window.plausible.q`. Во всех окружениях, где `initAnalytics()` — no-op (dev/test/прод без
`VITE_PLAUSIBLE_DOMAIN`), `window.plausible` остаётся `undefined` — вызовы через
`window.plausible?.(...)` там тихий no-op.

```ts
// src/vite-env.d.ts (добавление)
interface Window {
  plausible?: ((
    event: string,
    options?: { props?: Record<string, string | number | boolean> },
  ) => void) & { q?: unknown[] }
}
```

`trackEvent`/`trackPageview` дополнительно гейтятся через `isAnalyticsEnabled()` (не только
`window.plausible?.`) — чтобы в dev/test не тратить цикл на опциональный вызов и чтобы поведение
было симметрично `initSentry`/`initAnalytics` (единая точка "выключено ли всё это").

## What Goes Where

- **Implementation Steps** — код, тесты, документация в этом репозитории.
- **Post-Completion** — создание Plausible-сайта/домена, реальный `VITE_PLAUSIBLE_DOMAIN`,
  включение custom-event голов в Plausible dashboard, ручная проверка в проде.

## Implementation Steps

### Task 1: Зависимость `web-vitals` + env-плейсхолдеры + ambient-тип

**Files:**

- Modify: `package.json` / `pnpm-lock.yaml` (через `pnpm add web-vitals`)
- Modify: `.env.local`
- Modify: `.env.example`
- Modify: `src/vite-env.d.ts`

- [x] `pnpm add web-vitals` (production dependency — исполняется в браузере в рантайме, не
      build-time инструмент).
- [x] В `.env.local` добавить `VITE_PLAUSIBLE_DOMAIN=` (пустой плейсхолдер, по образцу
      `VITE_SENTRY_DSN`).
- [x] В `.env.example` добавить `VITE_PLAUSIBLE_DOMAIN=<plausible-domain>`.
- [x] В `src/vite-env.d.ts` добавить `interface Window { plausible?: ((event: string, options?:
      { props?: Record<string, string | number | boolean> }) => void) & { q?: unknown[] } }` —
      `q` — очередь событий, которую ставит queue-stub из Task 2 (см. там). Файл остаётся
      без единого `import`/`export` (иначе он перестанет быть ambient-декларацией, как и с
      `__APP_RELEASE__`). **Осознанное исключение из правила `type`, не `interface`**
      (`AGENTS.md`, "TypeScript style"): global declaration merging (расширение встроенного
      `Window`) работает только через `interface`, `type` для этого физически не годится —
      добавить короткий Russian WHY-комментарий над декларацией, чтобы это не "исправили"
      обратно на `type` в будущем ревью.
- [x] Тестов не требует (зависимость + статическая конфигурация, не код).

### Task 2: `src/shared/lib/analytics/analytics.ts` — initAnalytics, trackEvent, trackPageview

**Files:**

- Create: `src/shared/lib/analytics/analytics.ts`
- Create: `src/shared/lib/analytics/analytics.test.ts`
- Create: `src/shared/lib/analytics/index.ts`
- Modify: `src/shared/lib/index.ts`

- [x] `export const isAnalyticsEnabled = (): boolean => import.meta.env.PROD &&
      Boolean(import.meta.env.VITE_PLAUSIBLE_DOMAIN)` — **не** реэкспортируется из публичного
      `src/shared/lib/index.ts` (см. ниже), остаётся внутренней деталью модуля `analytics/` —
      у неё нет потребителей за пределами `analytics.ts`/`reportWebVitals.ts`.
- [x] **Критично**: `initAnalytics()` должен поставить Plausible's queue-stub на `window` ДО
      добавления `<script>` в DOM — динамически вставленный `<script>` (в отличие от
      статического тега в `index.html`) исполняется асинхронно вне зависимости от `defer`,
      поэтому `window.plausible` не определён ещё несколько миллисекунд после
      `initAnalytics()`. Без стаба первый `trackPageview()` (из `AppLayout`'s mount-эффекта,
      Task 5) и ранние web-vitals (LCP) теряются практически на каждой сессии — это не edge
      case, а фактическая поломка главного события. Официальный стаб Plausible для
      `script.manual.js`:
      ```ts
      window.plausible = window.plausible || function () {
        (window.plausible!.q = window.plausible!.q || []).push(arguments)
      }
      ```
      (тип `Window.plausible` из Task 1 дополнить необязательным `q?: unknown[]`, чтобы стаб
      типизировался без `any`).
- [x] `export const initAnalytics = (): void => {...}` — при `!isAnalyticsEnabled()` — `return`.
      Иначе: поставить стаб (см. выше); если `document.getElementById(
      'plausible-analytics-script')` уже существует — `return` (защита от повторного вызова,
      напр. HMR); иначе создать `<script>` с `id`, `defer = true`, `dataset.domain =
      import.meta.env.VITE_PLAUSIBLE_DOMAIN`, `src = 'https://plausible.io/js/script.manual.js'`,
      добавить в `document.head`.
- [x] `export const trackEvent = (name: string, props?: Record<string, string | number |
      boolean>): void => {...}` — при `!isAnalyticsEnabled()` — `return`. Иначе
      `window.plausible?.(name, props ? { props } : undefined)`.
- [x] `export const trackPageview = (): void => trackEvent('pageview')` — `'pageview'` —
      зарезервированное имя события в Plausible (не custom event), вызывает реальную запись
      просмотра страницы.
- [x] `src/shared/lib/analytics/index.ts` — ре-экспорт `initAnalytics`, `trackEvent`,
      `trackPageview`, `isAnalyticsEnabled` (последняя — для использования внутри
      `reportWebVitals.ts`, Task 3, тот же модуль).
- [x] В `src/shared/lib/index.ts` добавить `export { initAnalytics, trackEvent, trackPageview }
      from './analytics'` — без `isAnalyticsEnabled` (см. первый пункт выше).
- [x] Написать тесты на `isAnalyticsEnabled`/`initAnalytics` через `vi.stubEnv('PROD', ...)` +
      `vi.stubEnv('VITE_PLAUSIBLE_DOMAIN', ...)`: `!PROD` → скрипт не создан, стаб не
      установлен; `PROD` без домена → скрипт не создан; `PROD` + домен → в `document.head`
      появился `<script>` с верными `src`/`data-domain`/`defer`, и `window.plausible` определена
      (стаб) сразу после вызова, синхронно, до какой-либо сетевой загрузки; повторный вызов
      `initAnalytics()` не создаёт второй `<script>` (проверка через `document.querySelectorAll`).
- [x] Написать тест на **очередь до загрузки скрипта**: после `initAnalytics()` (стаб
      установлен, реальный Plausible-скрипт не выполнялся — в jsdom он и не выполнится) вызвать
      `trackEvent('foo')`/`trackPageview()` → вызов лёг в `window.plausible.q` (массив
      `arguments`-объектов), не потерялся молча.
- [x] Написать тесты на `trackEvent`/`trackPageview`: `window.plausible` не задан → вызов не
      бросает исключение; `window.plausible` — `vi.fn()`, аналитика включена → вызван с
      ожидаемыми `(name, options)`; аналитика выключена (`!PROD`) → `window.plausible` не
      вызван, даже если он определён.
- [x] **Изоляция тестов**: добавить `afterEach(() => { document.getElementById(
      'plausible-analytics-script')?.remove(); delete (window as { plausible?: unknown
      }).plausible; vi.unstubAllEnvs() })` (по образцу `src/app/sentry.test.ts:9`) — иначе
      `<script>`/стаб, оставленные одним тестом, ломают независимость последующих ("скрипт не
      создан" может ложно пройти из-за уже существующего элемента от предыдущего кейса).
- [x] `make test` — проходит.

### Task 3: `reportWebVitals.ts` — интеграция пакета `web-vitals`

**Files:**

- Create: `src/shared/lib/analytics/reportWebVitals.ts`
- Create: `src/shared/lib/analytics/reportWebVitals.test.ts`
- Modify: `src/shared/lib/analytics/index.ts`
- Modify: `src/shared/lib/index.ts`

- [x] `export const reportWebVitals = (): void => {...}` — при `!isAnalyticsEnabled()` —
      `return`. Модульный флаг `let reported = false` — если уже `true`, тоже `return` (защита
      от двойной регистрации callback'ов при повторном вызове/HMR, симметрично
      `initAnalytics()`'s `getElementById`-гейту в Task 2). Иначе `reported = true` и `void
      import('web-vitals').then(({ onLCP, onINP, onCLS }) => { onLCP(reportMetric);
      onINP(reportMetric); onCLS(reportMetric) })` — **динамический импорт**, не статический
      `import ... from 'web-vitals'` в начале файла: `analytics/index.ts` реэкспортируется через
      публичный барел `src/shared/lib/index.ts`, который тянется почти из всех модулей
      приложения — статический импорт затащил бы `web-vitals` в основной чанк ради одной
      прод-only точки вызова (актуально для бюджетов бандла из `2.5.3`).
- [x] Приватная `reportMetric = (metric: Metric): void => trackEvent(\`web vital: 
      ${metric.name.toLowerCase()}\`, { value: Math.round(metric.name === 'CLS' ? metric.value *
      1000 : metric.value), rating: metric.rating })` — имя события в нижнем регистре
      (`web vital: lcp`), единообразно с `'search submitted'`/`'filter changed'`/`'favorite
      added'` (см. Solution Overview) — Plausible-голы это буквальные строки, их болезненно
      переименовывать после накопления данных, поэтому регистр фиксируется один раз здесь.
- [x] Ре-экспортировать `reportWebVitals` из `src/shared/lib/analytics/index.ts` и
      `src/shared/lib/index.ts`.
- [x] Написать тесты через `vi.mock('web-vitals', () => ({ onLCP: vi.fn(), onINP: vi.fn(),
      onCLS: vi.fn() }))` и `vi.mock('./analytics', ...)` (сохраняя `isAnalyticsEnabled` мокнутым
      `true`/`false` по кейсу): аналитика выключена → ни один `on*` не вызван; аналитика включена
      → все три вызваны ровно по разу (дождаться `await vi.dynamicImportSettled()` или
      `await Promise.resolve()`/`flushPromises` — импорт `web-vitals` асинхронный); повторный
      вызов `reportWebVitals()` в том же модуле не регистрирует колбэки повторно; вызов
      зарегистрированного callback с `{ name: 'CLS', value: 0.123, rating: 'good' }` →
      `trackEvent` получил `'web vital: cls'` и `{ value: 123, rating: 'good' }`; аналогично для
      `'LCP'`/`'INP'` (→ `'web vital: lcp'`/`'web vital: inp'`) без домножения на 1000.
- [x] `make test` — проходит.

### Task 4: Вызов `initAnalytics()`/`reportWebVitals()` из `providers.tsx`

**Files:**

- Modify: `src/app/providers.tsx`
- Modify: `src/app/providers.test.tsx`

- [ ] На верхнем уровне модуля `providers.tsx`, рядом с `initSentry()` (до определения
      `Providers`), добавить вызовы `initAnalytics()` и `reportWebVitals()`.
- [ ] Дополнить существующий тест `providers.test.tsx` (мокающий `./sentry`) аналогичным
      `vi.mock('@shared/lib', ...)` — `providers.tsx` импортирует `initAnalytics`/
      `reportWebVitals` из `@shared/lib`, не из `./analytics` (такого локального модуля в
      `src/app/` нет), поэтому мокать нужно именно `@shared/lib`. Проверить, что
      `initAnalytics`/`reportWebVitals` вызваны по разу при импорте модуля.
- [ ] `make test` — проходит.

### Task 5: Page view tracking — `AppLayout.tsx`

**Files:**

- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `src/app/layouts/AppLayout.test.tsx`

- [ ] Импортировать `useEffect` из `react` и `trackPageview` из `@shared/lib`.
- [ ] Добавить `useEffect(() => { trackPageview() }, [location.pathname])` — реагирует только на
      смену `pathname`, не на изменение query-параметров (`?q`, `?genres`, и т.д.) в рамках той
      же страницы.
- [ ] **Важно про тест**: существующий `renderAt(path)`-хелпер в `AppLayout.test.tsx` монтирует
      свежий `MemoryRouter` на каждый вызов — этим хелпером нельзя отличить "сменился pathname"
      от "сменились только query-параметры", т.к. каждый кейс — отдельный fresh-mount, и оба
      сценария дают тривиально по 1 вызову. Для этой задачи нужна отдельная тестовая обвязка
      (не переиспользующая `renderAt`), которая монтирует роутер один раз и затем реально
      навигирует внутри того же дерева — например `createMemoryRouter([{ element: <AppLayout
      />, children: [...] }], { initialEntries: [...] })` + `<RouterProvider router={router} />`
      (`react-router`), и дальше `router.navigate('/favorites')` / `router.navigate('/?x=1')`
      внутри `act()`/`await waitFor`.
- [ ] Написать тест: `vi.mock('@shared/lib', ... trackPageview: vi.fn())` (с
      `vi.importActual` для остальных реальных экспортов `useViewport` и т.д., которые
      `AppLayout` уже использует) — начальный рендер на `/` → `trackPageview` вызван 1 раз;
      `router.navigate('/favorites')` (смена `pathname`) в том же смонтированном дереве → вызван
      ещё раз (итого 2); `router.navigate('/favorites?x=1')` (смена только query-параметров на
      том же `pathname`) → `trackPageview` не вызывается повторно (всё ещё 2).
- [ ] `make test` — проходит.

### Task 6: Search submitted tracking — `useSearchAnalytics`

**Files:**

- Create: `src/pages/search/model/useSearchAnalytics.ts`
- Create: `src/pages/search/model/useSearchAnalytics.test.ts`
- Modify: `src/pages/search/ui/Search/Search.tsx`

- [ ] **Важно**: `query`, приходящий из `Search.tsx` (`searchParams.get('q')`), уже
      debounce-committed `Header`'ом, но самим `Header`'s дебаунсом всего в `QUERY_DEBOUNCE_MS`
      (250мс, `src/widgets/header/ui/Header/Header.tsx`) — печатая одно слово, пользователь
      коммитит в `?q` несколько промежуточных непустых значений подряд ("ba" → "batm" →
      "batman"), каждое из которых прошло бы через голый transition-ref как отдельный "submit".
      Поэтому `useSearchAnalytics` сначала прогоняет `query` через `useDebouncedValue` (
      `@shared/lib`, уже используется в `Header`) с бо́льшей задержкой — **800мс** — прежде чем
      сравнивать с последним затреканным значением: `const settledQuery =
      useDebouncedValue(query, 800)`. Это гасит серию быстрых промежуточных коммитов `?q` в одно
      "устоявшееся" значение перед трекингом.
- [ ] `src/pages/search/model/useSearchAnalytics.ts`: `export const useSearchAnalytics = (query:
      string): void => {...}` — `useRef<string>('')` хранит последний затреканный (непустой)
      query; `useEffect` на `[settledQuery]`: `const trimmed = settledQuery.trim(); if (trimmed
      && trimmed !== lastTrackedRef.current) { trackEvent('search submitted');
      lastTrackedRef.current = trimmed } else if (!trimmed) { lastTrackedRef.current = '' }`
      (сброс рефа на пустой query — иначе повторный ввод того же текста после очистки поля не
      затрекается снова).
- [ ] Не отправлять сам текст запроса как prop (`trackEvent('search submitted')` без `props`) —
      минимизирует объём пользовательских данных в аналитике, соответствует выбору Plausible
      как privacy-first решения.
- [ ] В `Search.tsx` вызвать `useSearchAnalytics(query)` сразу после строки, где вычисляется
      `query = searchParams.get('q') ?? ''` (`src/pages/search/ui/Search/Search.tsx:184`).
- [ ] Написать тесты на `useSearchAnalytics` через `renderHook` (`@testing-library/react`) +
      `vi.mock('@shared/lib', ... trackEvent: vi.fn())` (сохраняя реальный `useDebouncedValue`
      через `vi.importActual`) + `vi.useFakeTimers()`: серия быстрых `rerender`'ов с
      промежуточными значениями (`'ba'` → `'batm'` → `'batman'`, каждый до истечения 800мс) →
      после `vi.advanceTimersByTime(800)` `trackEvent` вызван ровно 1 раз с итоговым
      `'search submitted'` (а не 3); повторный рендер с тем же `query` после устаканивания → не
      вызван снова; смена на другой непустой `query` (с выдержкой 800мс) → вызван снова; переход
      в пустой `query`, затем обратно на тот же текст, что был раньше → вызван снова (реф
      сброшен).
- [ ] `make test` — проходит.

### Task 7: Filter changed tracking — `useFilterState.ts`

**Files:**

- Modify: `src/features/catalog-filter/model/useFilterState.ts`
- Modify: `src/features/catalog-filter/model/useFilterState.test.tsx`

- [ ] Импортировать `trackEvent` из `@shared/lib`.
- [ ] В `applyFilters` (единственная точка коммита `FilterState` в URL — вызывается из
      `setFilters`/`toggleGenre`/сброса диапазона года/рейтинга) добавить `trackEvent('filter
      changed')` до или после `setSearchParams` (порядок не важен — `trackEvent` не зависит от
      результата навигации).
- [ ] Не трекать `setSort` — роадмап называет только "filter changed" в списке из четырёх
      событий, сортировка не входит.
- [ ] Дополнить существующие тесты `useFilterState.test.tsx`: `vi.mock('@shared/lib', ...
      trackEvent: vi.fn())` (сохраняя остальные реальные экспорты через `vi.importActual`) —
      вызов `setFilters(...)`/`toggleGenre(...)` → `trackEvent` вызван с `'filter changed'`;
      вызов `setSort(...)` → `trackEvent` НЕ вызван.
- [ ] `make test` — проходит.

### Task 8: Favorite added tracking — `useFavorites.ts`

**Files:**

- Modify: `src/features/favorites/model/useFavorites.ts`
- Modify: `src/features/favorites/model/useFavorites.test.ts`

- [ ] Импортировать `trackEvent` из `@shared/lib`.
- [ ] В `toggle(id)`: в ветке, где `id` ещё не было в `current` (т.е. фильм добавляется, а не
      удаляется), добавить `trackEvent('favorite added')` — не в ветке удаления.
- [ ] Не трогать `add(id)` отдельно (нет вызывающих в `.tsx`, дублировать логику трекинга там же
      не нужно, но раз функция публичная и может получить вызывающего в будущем — оставить как
      есть без трекинга до появления реального потребителя, чтобы не выдумывать событие для
      мёртвого пути).
- [ ] Дополнить существующие тесты `useFavorites.test.ts`: `vi.mock('@shared/lib', ...
      trackEvent: vi.fn())` — `toggle(id)` на отсутствующем id → `trackEvent('favorite added')`
      вызван; `toggle(id)` на уже избранном id (удаление) → `trackEvent` НЕ вызван.
- [ ] `make test` — проходит.

### Task 9: Документация — AGENTS.md и roadmap.md

**Files:**

- Modify: `AGENTS.md`
- Modify: `plans/roadmap.md`

- [ ] В `AGENTS.md` добавить раздел «Web Vitals + Analytics (Plausible)» рядом с разделом
      «Error tracking (Sentry)»: состав `src/shared/lib/analytics/` (`initAnalytics`,
      `trackEvent`, `trackPageview`, `reportWebVitals` — публичные; `isAnalyticsEnabled` —
      внутренняя деталь модуля, не реэкспортируется из `@shared/lib`), прод-only гейт через
      `VITE_PLAUSIBLE_DOMAIN`, queue-stub на `window.plausible` перед вставкой `<script>` (и
      почему без него терялся бы первый pageview каждой сессии), `.manual.js`-скрипт и почему
      нужен ручной `trackPageview` на смену роута (SPA), `reportWebVitals`'s динамический импорт
      `web-vitals` (не раздувать основной чанк), CLS `*1000`, нижний регистр имён событий
      (`web vital: lcp` и т.д. — Plausible-голы это буквальные строки, дорого переименовывать),
      принятое ограничение про отсутствие `sendBeacon`-доставки поздних vitals-метрик на
      page-hide, `interface Window` как осознанное исключение из правила `type`-не-`interface`
      (global declaration merging), точки интеграции четырёх событий и почему именно там
      (page view — `AppLayout` на смену `pathname`; search submitted — `useSearchAnalytics` с
      transition-ref поверх собственного 800мс `useDebouncedValue`, гасящего всплеск от
      `Header`'s 250мс дебаунса `?q`, паттерн transition-ref — аналогично `usePageSync`; filter
      changed — `applyFilters`, не `setSort`; favorite added — ветка добавления в `toggle`, не
      `add`).
- [ ] Обновить строку `@shared/lib` в таблице "Key public APIs" — добавить `initAnalytics()`,
      `trackEvent()`, `trackPageview()`, `reportWebVitals()` (без `isAnalyticsEnabled()` — не
      публичный экспорт барела, см. выше).
- [ ] В `plans/roadmap.md` отметить чекбоксы `2.5.2` (`- [ ]` → `- [x]`) после завершения всех
      задач этого плана.
- [ ] Тестов не требует.

### Task 10: Верификация и перенос плана

- [ ] `pnpm exec tsc -b` — чисто.
- [ ] `make lint` — чисто (oxlint, `noUnusedLocals`-related на новый модуль `analytics/`).
- [ ] `make test` — весь набор тестов проходит.
- [ ] `make build` без `VITE_PLAUSIBLE_DOMAIN` в окружении — билд не падает, `initAnalytics`/
      `reportWebVitals` в собранном бандле присутствуют, но не активны (проверяется тестами
      Task 2-3, не билдом напрямую).
- [ ] Собрать с фиктивным `VITE_PLAUSIBLE_DOMAIN` + `NODE_ENV=production`/`vite build` —
      убедиться, что итоговый HTML/JS не ломается, `initAnalytics()` в браузере (можно
      `make preview` + DevTools) пытается подгрузить `plausible.io/js/script.manual.js`
      (сетевой запрос уйдёт и упадёт 404 без реального домена в Plausible — ожидаемо, не блокер).
- [ ] Проверить все чекбоксы плана и `plans/roadmap.md` отмечены.
- ➕ [ ] **Не связано с 2.5.2, напоминание от пользователя (2026-09-10) — выполнить, если ещё не
      сделано**: добавить `.claude/worktrees/` в `.gitignore`; завести `.worktreeinclude` в
      корне репозитория со списком файлов, которых нет в git, но которые нужны каждому
      worktree (`.env.local`) — тогда они будут копироваться в каждый новый worktree
      автоматически. Проверено на момент создания этого пункта: ни `.gitignore`, ни
      `.worktreeinclude` этого ещё не содержат/не существуют.
- [ ] Переместить этот файл в `docs/plans/completed/`.

## Post-Completion

**Внешние системы:**

- Создать сайт в Plausible (или self-hosted инстанс), получить реальный `data-domain`, задать
  `VITE_PLAUSIBLE_DOMAIN` в проде (Vercel/Netlify env vars).
- В Plausible dashboard включить/настроить custom-event голы: `pageview` (встроенный),
  `search submitted`, `filter changed`, `favorite added`, `web vital: lcp`/`inp`/`cls`.

**Ручная проверка:**

- После деплоя с реальным доменом — открыть DevTools Network, убедиться, что события реально
  долетают до `plausible.io/api/event` при навигации/поиске/фильтрации/добавлении в избранное.
- Сверить значения LCP/INP/CLS в Plausible с Lighthouse/Chrome DevTools Performance на той же
  странице — грубая сверка порядка величин, не точное совпадение (разные механизмы измерения).
