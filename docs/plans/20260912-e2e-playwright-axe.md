# E2E-тесты (Playwright) с axe-core — roadmap 2.5.5

## Overview

Roadmap `2.5.5` (`plans/roadmap.md`): первая E2E-обвязка проекта. Сейчас в репозитории есть только unit/integration-тесты на Vitest+jsdom+MSW (`src/**/*.test.{ts,tsx}`) — ни одного теста, реально запускающего браузер против собранного приложения, не существует. Нужно:

- добавить `@playwright/test` + `@axe-core/playwright`;
- завести `e2e/` со smoke-тестами на 6 ключевых user journeys из roadmap (главная, поиск, фильтры, деталь фильма с табами, favorites persist, theme toggle) **плюс отдельные smoke-тесты на `/popular` и `/recommendations`, а также явную проверку самой страницы `/favorites`** — эти три роута не входят в буквальный список roadmap, но без них в SPA остаются непокрытые страницы (см. Context/Solution Overview);
- в каждый тест добавить a11y-проверку через `AxeBuilder`;
- отдельный Playwright project с mobile-viewport эмуляцией (`devices['iPhone 13']`) хотя бы на `/`, `/search`, `/movie/:id`;
- CI job с шардингом на каждый PR.

Решение — тестировать против **реального API** (не MSW-мока в браузере) через **production preview-сборку** (`vite preview`), см. ниже.

## Context (from discovery)

- Тестовый стек: Vitest (`jsdom`), MSW `msw/node` (`src/test/setup.ts`), Testing Library — но всё это Node/jsdom-side, не браузерное.
- `vite.config.ts`: единственный `test: { environment: 'jsdom', setupFiles: [...], globals: true }` блок, без явного `include`/`exclude` → Vitest использует дефолтный паттерн `**/*.{test,spec}.*`, который **захватит** будущие Playwright-файлы `e2e/*.spec.ts`, если их не исключить явно.
- `tsconfig.json` — solution-style, референсит `tsconfig.app.json` (src/) и `tsconfig.node.json` (root-конфиги: `vite.config.ts`, `sentry.config.ts`, `bundle.config.ts`, их `.test.ts`, `vercel-headers.test.ts`). `tsconfig.node.json` не подключает `"lib": ["DOM"]` — новый `playwright.config.ts`/`e2e/**` логически попадают туда же (Node-контекст), но спеки не должны использовать сырые DOM-типы (`document`/`HTMLElement`) в `page.evaluate`/`locator.evaluate` — только Playwright API (`Locator.getAttribute()` и т.п.), которые возвращают обычные `string`/`null`, не требуя DOM lib.
- `Makefile` — единая точка входа команд, CI вызывает только `make *`. `.github/workflows/ci.yml` — 7 параллельных jobs (`lint`, `typecheck`, `test`, `audit`, `size`, `knip`, `build`), `build` уже требует `SENTRY_*` секреты через `env:` на шаге; `VITE_API_KEY`/`VITE_BASE_URL` в CI сейчас **не выставляются вообще** (не нужны для `tsc -b`/`vite build`, которые не делают реальных запросов).
- `knip.jsonc` — `entry` явно перечисляет root-конфиги и `**/*.test.{ts,tsx}`, иначе knip считает тест-only devDependencies unused; новый `@playwright/test`/`@axe-core/playwright` попадут в ту же категорию, если не добавить `playwright.config.ts` + `**/*.spec.ts` в `entry` (knip также умеет автоопределять Playwright по `playwright.config.ts`, но явная запись — в духе уже принятого в проекте стиля «explicit decision» из 2.5.3).
- Селекторы: в проде нет ни одного `data-testid` (проверено грепом) — весь UI уже кликается по `role`/`aria-label`/`placeholder`/тексту. Ключевые проверенные по исходникам точки:
  - `HeroSection` (`src/pages/home/ui/HeroSection`) — `<input>` без `aria-label`, только `placeholder='Try "films from 2024 rated 8+" or a title…'`; кнопка `Search` — `<button type="button">Search</button>`. Рендерится только на `/`.
  - `Header` (`src/widgets/header/ui/Header/Header.tsx`) — поисковый `<input aria-label="Search movies, series, anime">` рендерится **только при `variant === 'search'`** (строка 158), а этот вариант монтируется `AppLayout`'ом только на `/search` (`SEARCH_CHROME`). На `/` второго текстового поля нет — `getByPlaceholder(...)` для `HeroSection` там однозначен.
  - `Card` (`@entities/movie`) — favorite-кнопка (`Card.tsx`, единственный DOM-узел на оба брейкпоинта после мобильной миграции) имеет `aria-label="Add to favorites"`/`"Remove from favorites"`; на странице одновременно рендерится **несколько карточек**, у всех невыбранных — одинаковый `aria-label="Add to favorites"`, поэтому `getByRole('button', { name: ... })` без `.first()`/скоупинга внутри конкретной карточки кидает Playwright strict-mode violation.
  - `MovieTabsNav` — обычные `<button>{label}</button>` без ARIA tab-ролей, `getByRole('button', { name: 'Cast' })` работает.
  - `ThemeToggle` — `aria-label` динамический: `"Switch to light theme"` / `"Switch to dark theme"`.
- **Существующие пробелы в a11y, найденные при подготовке плана (грепом+чтением исходников), блокирующие требование «нет critical violations» из коробки** — `button-name` (axe impact `critical`) нарушается на:
  - `Header.tsx:204` — `<IconButton onClick={() => navigate('/search')}><SearchIcon/></IconButton>` (иконка поиска в шапке) — без `aria-label`.
  - `Header.tsx:208` — `<IconButton><BellIcon/>...</IconButton>` (иконка уведомлений, сейчас даже без `onClick`) — без `aria-label`.
  - `Card.tsx` — `<CardBtn icon={<EyeIcon />} square />`: у `CardBtn` (`CardBtn.tsx`) `aria-label` берётся **только** из отдельного пропа `ariaLabel`, а не из `label` — у кнопок Rate/Add есть видимый текст (`label='Rate'`/`'Add'`, рендерится как `<span>`, даёт accessible name через текстовое содержимое), у Eye — ни текста, ни `ariaLabel`.
  - `MobileHeader.tsx` — кнопка `.backBtn` (`<button onClick={onBack}><ChevronLeftIcon/></button>`) — без `aria-label`, рендерится там, где передан `onBack` (в частности на `/movie/:id` в мобильном chrome — ровно один из трёх роутов mobile-project'а).
  - `Pagination.tsx` (`src/pages/search/ui/Pagination`) — prev/next кнопки только с `ChevronLeftIcon`/`ChevronRightIcon`, без `aria-label`. Рендерится на `/search` всегда — блокирует Task 4.
  - `ActiveFilterChips.tsx` (`src/features/catalog-filter/ui/ActiveFilterChips`) — кнопки удаления чипа (`chipRemove`/`chipCompactRemove`) только с `CloseIcon`, без `aria-label`. Появляются сразу после клика по жанру — ровно в сценарии «фильтр» из Task 4, между кликом и `checkA11y`.
  - `BottomSheet.tsx` (`src/widgets/mobile-chrome/ui/BottomSheet`) — `.closeBtn` (крестик в `.titleRow`) только с `CloseIcon`, без `aria-label` (backdrop-кнопка рядом уже имеет `aria-label='Close'` — это нормально, нарушение именно в `.closeBtn`). Закрытое состояние — `transform: translateY(100%)`, не `display:none`, поэтому остаётся в a11y-дереве даже закрытым. На мобильном `/search` смонтированы два `BottomSheet` одновременно — блокирует Task 8.
  - Это не полный список — `ArrowBtn`/`BottomNav`/`GenreSelector` и т.п. проверены точечно и уже имеют `aria-label`/видимый текст, но полную гарантию даёт только реальный прогон axe (см. Task 2).
- Env: `VITE_API_KEY`/`VITE_BASE_URL` читаются из `.env.local` (в `.gitignore`, не в CI). Для E2E с реальным API билд в CI должен получить `VITE_API_KEY` как secret; `VITE_BASE_URL` — публичное значение (`https://api.poiskkino.dev`, см. `.env.example`), тот же прецедент, что уже принят для `SENTRY_URL` в `build`-job'е (не секрет, литерал в `env:`).
- Квота: AGENTS.md фиксирует demo-тир 200 запросов/день. Подсчёт по факту разбора рейлов/страниц: `/` — 4 параллельных рейла (`Home.tsx`: `PopularMoviesRail`, `TrandingSeriesRail`, `TopAnimeRails`, `PersonalRails`), плюс `createSessionCache` не персистит между page-load'ами в prod-сборке (персист — только под `import.meta.env.DEV`) — то есть каждая навигация на `/` в preview-сборке снова бьёт в API. Полный E2E-прогон (все спеки, все projects) — по грубой оценке 35-45 запросов. При шардинге запросы не размножаются (шардинг делит тесты между воркерами), но при триггере job'а и на `pull_request`, и на `push: main` — фактически удваивается на каждый смёрженный PR. Решение (см. Technical Details/Task 11): job триггерится **только на `pull_request`** (не на `push: main` — `push` дублирует уже пройденную PR-проверку) + `concurrency`-группа с `cancel-in-progress`, чтобы повторные пуши в PR не копили квоту от устаревших прогонов. Это даёт ~35-45 запросов на один прогон PR — примерно 4-5 прогонов в день укладываются в квоту, но `retries: 1` в CI удваивает стоимость упавшего спека, а локальная разработка бьёт в тот же ключ параллельно с CI; при исчерпании квоты job будет красным недетерминированно (403 от API, не баг теста) — см. Post-Completion. Отдельно: Task 2 (ручные прогоны axe против `make preview`, до появления автоматических спеков) сам по себе бьёт в тот же живой API — два прохода × 5 роутов/состояний ≈ 30-40 запросов за день реализации Task 2, из той же дневной квоты; не стоит планировать Task 2 и первый прогон Task 3 в один календарный день. Добавление Task 7/8 (`/popular`, `/recommendations`) и /favorites-перехода в Task 6 увеличивает оценку на ~3-5 запросов (`/popular` — 1 запрос к `GET /v1.5/list/popular`; `/recommendations` в пустом состоянии — 0 запросов, ветка `ids.length === 0` в `Recommendations.tsx` не доходит до `AsyncBoundary`/`useFavoriteMovies()`; повторный `getMoviesByIds` на `/favorites` после `reload()` — 1 запрос, in-memory-кэш сбрасывается вместе с JS-рантаймом страницы) — общая оценка полного прогона обновляется до ~40-50 запросов.

## Development Approach

- **Testing approach:** Regular — сами E2E-спеки и есть тесты этого плана; каждая задача заканчивается прогоном `pnpm exec playwright test <файл>` (или `make e2e` для полного набора) против реального API.
- Один task = один логический кусок (конфиг, a11y-фиксы, один спек-файл, один CI-job).
- Каждый task полностью зелёный локально перед переходом к следующему.
- План обновляется по ходу (➕ на новые находки, ⚠️ на блокеры).

## Testing Strategy

- Тесты этого плана — сами Playwright-спеки в `e2e/`, отдельного Vitest unit-покрытия для них не требуется (это тестовый код, а не продовый).
- Каждый спек обязан закончиться вызовом общего a11y-хелпера (`e2e/utils/a11y.ts`) — assert «нет violations с `impact === 'critical'`» (roadmap: «нет critical violations», не «ноль violations вообще» — сторонний Google Fonts (Plausible в e2e-билд не грузится, см. Solution Overview) не должен ронять тест minor/moderate шумом).
- Task 2 — отдельный предварительный шаг: без него Task 3 (первый реальный спек с a11y-проверкой) гарантированно красный на существующих critical-нарушениях (см. Context). Это правки прод-кода вне формального скоупа roadmap 2.5.5, но необходимые, чтобы сам критерий приёмки 2.5.5 («нет critical violations») был вообще достижим.
- `make test` (Vitest) должен продолжать проходить без изменений после того, как в `vite.config.ts` появится `test.exclude` — и не терять уже существующие тестовые файлы (проверяется явным подсчётом, см. Task 1).

## Progress Tracking

- Отмечай `[x]` сразу по завершении.
- ➕ — новые задачи, обнаруженные по ходу.
- ⚠️ — блокеры.

## Solution Overview

- **Реальный API, без MSW-мока в браузере.** Playwright бьёт в тот же живой `https://api.poiskkino.dev`, что и прод — максимально реалистично, без отдельной инфраструктуры `msw/browser` + service worker. Риск — квота 200 req/день; митигируется малым числом smoke-сценариев, отказом от дублирующего `push`-триггера и `concurrency`-отменой устаревших прогонов (см. Context/Task 11). HAR-replay (`page.routeFromHAR`) рассматривался как более дешёвая по квоте альтернатива, но отклонён — он меняет саму суть уже согласованного решения «бить в реальный API»; зафиксирован как возможный fallback в Post-Completion, если квота всё равно не выдержит.
- **`vite preview` (production-сборка), не `vite dev`.** Playwright's `webServer` поднимает `vite preview` над уже собранным `dist/` — так E2E проверяет то же самое, что реально задеплоится (code-splitting, минификация), и совпадает по духу с 2.5.6 (Lighthouse тоже будет гонять по preview/deploy URL). **Не проверяет** CSP-заголовки — `vercel.json`'s `headers` применяется хостингом (Vercel), а не `vite preview`; это не покрывается E2E из этого плана.
- **`e2e/` — Node-контекст, свой `tsconfig.node.json`-include, свой `test.exclude` в Vitest.** Спеки не импортируют `src/**` напрямую (никаких path-алиасов `@shared/*` в e2e) — все селекторы через `role`/`label`/`placeholder`/текст, без завязки на внутренние константы приложения.
- **Разделение desktop/mobile через `testDir`, а не дублирование всего сьюта.** Roadmap просит mobile-project «хотя бы» на 3 роутах (`/`, `/search`, `/movie/:id`), не на всём сьюте — поэтому `e2e/mobile/` — отдельная директория с отдельным, урезанным набором спеков, а не второй прогон всех спеков под `devices['iPhone 13']` (который просто удвоил бы расход квоты без пользы).
- **CI job шардится (`--shard=N/M`), каждый шард сам поднимает build+preview** (не шарит `dist/` через artifacts) — проще, чем artifact-плюмбинг, а билд SPA — секунды. Roadmap буквально просит `--workers=4` (параллельные воркеры на одной машине); в CI с несколькими независимыми job'ами `--shard=N/4` — прямой аналог с тем же уровнем параллелизма, но между машинами, а не потоками внутри одной — сознательное отклонение от буквальной формулировки, задокументированное в AGENTS.md (Task 13).
- **Не передавать `VITE_SENTRY_DSN`/`VITE_PLAUSIBLE_DOMAIN` на build-шаге e2e job'а.** Оба флага-инициализации (`initSentry()`/`initAnalytics()`, см. AGENTS.md) — no-op при пустом значении; если E2E-билд не получает эти два secret'а, preview не шлёт реальный error/analytics-шум от прогонов CI в прод-проекты Sentry/Plausible. Только `VITE_API_KEY`/`VITE_BASE_URL` передаются в build-шаг e2e job'а.
- **Покрытие расширено до всех 6 SPA-роутов, не только буквальных 6 journeys roadmap.** Roadmap 2.5.5 перечисляет 6 сценариев (главная, поиск, фильтры, деталь, favorites persist, theme toggle), но в приложении 6 роутов (`/`, `/search`, `/movie/:id`, `/favorites`, `/popular`, `/recommendations`) — `/popular` и `/recommendations` не покрывались ни одним из них, а исходный Task 6 (favorites) проверял только тумблер на `/`, ни разу не открывая саму страницу `/favorites`. Добавлены Task 7 (`/popular`) и Task 8 (`/recommendations`), плюс явный переход на `/favorites` внутри Task 6 — решение зафиксировано здесь, чтобы не потерять его при следующем чтении плана.

## Technical Details

- **`playwright.config.ts` (root)**:
  - `testDir: './e2e'`, default project `{ name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/mobile/**' }`.
  - `{ name: 'Mobile Safari', use: { ...devices['iPhone 13'] }, testDir: './e2e/mobile' }` — второй project с собственным `testDir`, физически не видит спеки за пределами `e2e/mobile/`.
  - `webServer: { command: 'pnpm exec vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI, timeout: 30_000 }` — команда **не** запускает билд, билд — отдельный явный шаг до `playwright test` (и локально, и в CI); `webServer` стартует один раз на весь `playwright test`-прогон (не на каждый ретрай).
  - `use: { baseURL: 'http://localhost:4173', trace: 'on-first-retry' }`, `expect: { timeout: 10_000 }` (дефолтные 5s — риск флейков на живом API + холодном CI-раннере), `retries: process.env.CI ? 1 : 0`, `reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list'`.
- **`e2e/utils/a11y.ts`** — `checkA11y(page: Page)`: `new AxeBuilder({ page }).analyze()`, фильтр `results.violations.filter(v => v.impact === 'critical')`, `expect(critical, JSON.stringify(critical.map(v => v.id))).toEqual([])` — сообщение об ошибке сразу содержит id правил.
- **Множественные карточки с одинаковым `aria-label` на `Card`** — в спеках, кликающих favorite-кнопку, всегда `.first()` на локаторе по `aria-label` (см. Context), иначе Playwright strict-mode падает с «resolved to N elements».
- **Стабильный селектор карточки фильма — `page.locator('a[href^="/movie/"]').first()`, не `getByRole('link').first()`.** На `/` до первой карточки в DOM идут `Header`'s логотип (`<Link to='/'>`) и заголовки-ссылки рейлов (`MovieRail`'s `<Link to={href}>`, ведут на `/search`/`/popular`) — голый `getByRole('link').first()` резолвится в логотип, не в карточку. Фильтр по `href`-паттерну — атрибут прикладного контракта (react-router генерирует `/movie/:id`), не хешированный CSS-класс, поэтому не нарушает принцип «без завязки на внутренности» (см. Solution Overview).
- **Скоуп favorite-кнопки к конкретной карточке (Task 6) — через `filter({ has: ... })`, не через climbing по классам.** Title-`Link` живёт в `.info`, favorite-кнопка — в соседнем `.posterContainer`; оба — прямые дети общего `.card`-узла, но у элемента нет доступного через public API текстового/ролевого способа это выразить, кроме как найти общий контейнер-предок, содержащий **оба** элемента как потомков: `page.locator('div').filter({ has: page.getByRole('link', { name: title, exact: true }) }).filter({ has: page.getByRole('button', { name: /favorites$/ }) })` — среди всех `div` на странице только `.card` содержит одновременно и конкретную ссылку с этим названием, и favorite-кнопку, поэтому локатор резолвится однозначно без единого упоминания CSS-класса.
- **`vite.config.ts`** — `test.exclude: [...configDefaults.exclude, 'e2e/**']` (импорт `configDefaults` из `'vitest/config'`) — **не** копировать дефолтный список вручную, чтобы не рассинхронизироваться при апдейте Vitest.
- **`tsconfig.node.json`** — добавить `playwright.config.ts`, `e2e/**/*.ts` в `include`. DOM lib не добавляется — спеки используют только Playwright API (`Locator`/`Page`), не сырые DOM-типы (см. Context).
- **`knip.jsonc`** — добавить `playwright.config.ts` и `e2e/**/*.spec.ts` в `entry` (с комментарием-обоснованием в стиле существующих).
- **`Makefile`** — новые таргеты `e2e` (`pnpm exec playwright test`) и `e2e-install` (`pnpm exec playwright install --with-deps chromium webkit`) — firefox не ставим, он не используется ни одним project. Добавляются в Task 1, потому что используются начиная с Task 3.
- **`.gitignore`** — `playwright-report/`, `test-results/`, `blob-report/`, `playwright/.cache/`.
- **CI (`.github/workflows/ci.yml`)** — новый job `e2e`. `on:` в GitHub Actions существует только на уровне workflow (уже `pull_request` + `push: main` в этом файле) — у job'а такого ключа нет, поэтому ограничение триггера — через `if:` на самом job'е, не через несуществующий job-level `on:`:
  - `if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository` — не запускается на `push: main` (см. Context — квота, дублирует уже пройденную PR-проверку) и не запускается на PR из форков (секреты там недоступны в принципе — билд пройдёт, но `VITE_API_KEY` будет пустым и все спеки упадут на 401/403; принятое ограничение, не «пока не заведены», а «форки не поддерживаются»). Задокументировать оба решения в AGENTS.md (Task 11).
  - `concurrency: { group: e2e-${{ github.ref }}-${{ matrix.shard }}, cancel-in-progress: true }` — **группа обязательно включает `matrix.shard`**: без этого все 4 шардовых job'а одного прогона попадают в одну группу и `cancel-in-progress` заставляет их отменять друг друга (до конца доживает фактически один шард из четырёх). С шардом в группе отменяется только устаревший прогон того же шарда на повторном пуше.
  - `timeout-minutes: 15` — без этого зависший `webServer`/живой API может растянуть job на дефолтные 360 минут ×4 шарда.
  - `needs: [lint, typecheck, test]` (не тратим CI-минуты и квоту API, если базовые проверки уже красные).
  - `strategy.fail-fast: false`, `matrix.shard: [1, 2, 3, 4]`.
  - Кеш браузеров Playwright: `actions/cache` по ключу с версией `@playwright/test` из `pnpm-lock.yaml`, путь `~/.cache/ms-playwright`. **Кеш не покрывает системные библиотеки, которые ставит `--with-deps`** (apt-пакеты для WebKit и т.п.) — поэтому `make e2e-install` (полный `playwright install --with-deps chromium webkit`) выполняется **всегда, безусловно**, а не только при cache miss; `playwright install` сам по себе пропускает повторную загрузку уже закешированных бинарников браузеров, так что кеш всё равно даёт реальный выигрыш по времени без риска сломать WebKit на cache hit.
  - Шаги: checkout → pnpm/node setup → `pnpm install --frozen-lockfile` → `make e2e-install` → `make build-only` (env: **только** `VITE_API_KEY`, `VITE_BASE_URL` из secrets/vars — без `SENTRY_*`/`VITE_PLAUSIBLE_DOMAIN`, см. Solution Overview) → `pnpm exec playwright test --shard=${{ matrix.shard }}/4` → `actions/upload-artifact` с **уникальным именем на шард** (`name: playwright-report-${{ matrix.shard }}`) для `playwright-report/` при `failure()`.
  - ⚠️ Этот job не может быть зелёным, пока в репозитории не заведены secrets `VITE_API_KEY` (и, при желании, `VITE_BASE_URL` как repo variable) — см. Post-Completion. Task 11 добавляет конфиг, но включение job'а как required-check откладывается до появления secrets.
- **Свежий `dist/` перед каждым прогоном.** `webServer.command` намеренно не билдит (см. выше) — значит каждый чекбокс, вызывающий `pnpm exec playwright test`, обязан идти после `make build-only`, иначе `vite preview` поднимется над устаревшей сборкой (например, без a11y-фиксов из Task 2). Каждая из Tasks 3-10 явно включает `make build-only` перед прогоном спека.

## What Goes Where

- **Implementation Steps** — a11y-фиксы прод-кода, конфиг, спеки, CI-job, документация.
- **Post-Completion** — добавление GitHub Secrets (`VITE_API_KEY`, опционально `VITE_BASE_URL` как variable), наблюдение за квотой API в первые дни работы job'а, возможное подключение E2E как required-check в branch protection, HAR-replay как fallback если квоты всё равно не хватает.

## Implementation Steps

### Task 1: Playwright-скаффолд (deps, config, tsconfig, vitest exclude, Makefile)

**Files:**
- Modify: `package.json`
- Create: `playwright.config.ts`
- Modify: `tsconfig.node.json`
- Modify: `vite.config.ts`
- Modify: `.gitignore`
- Modify: `Makefile`
- Modify: `knip.jsonc`

- [x] `pnpm add -D @playwright/test @axe-core/playwright`
- [x] `pnpm exec playwright install --with-deps chromium webkit` (локально, для разработки) — chromium установлен полностью; WebKit в этом окружении (macOS 14.4, `mac14-arm64`) Playwright отказался ставить как «frozen» с предупреждением обновить ОС — известное ограничение локальной машины, не блокирует конфиг (CI на `ubuntu-latest` ставит WebKit нормально, см. Task 11)
- [x] создать `playwright.config.ts` с двумя projects (`chromium` с `testIgnore: '**/mobile/**'`, `Mobile Safari` с `testDir: './e2e/mobile'`), `webServer` над `vite preview --port 4173 --strictPort`, `baseURL`, `expect.timeout: 10_000`, `retries`/`reporter` по `process.env.CI`
- [x] добавить `playwright.config.ts`, `e2e/**/*.ts` в `include` у `tsconfig.node.json`
- [x] в `vite.config.ts` добавить `test.exclude: [...configDefaults.exclude, 'e2e/**']` (импорт `configDefaults` из `'vitest/config'`) — попутно пришлось убрать существовавший `/// <reference types="vitest/config" />` в шапке файла: oxlint's `typescript(triple-slash-reference)` запрещает reference-директиву на модуль, который в файле уже импортируется обычным `import` (здесь — новый `import { configDefaults } from 'vitest/config'`); именованный импорт сам подтягивает нужную ambient-аугментацию `UserConfig['test']`, `make typecheck` подтверждает, что типизация `test`-поля не потерялась — см. `[decision]` в progress-логе
- [x] добавить `playwright-report/`, `test-results/`, `blob-report/`, `playwright/.cache/` в `.gitignore`
- [x] добавить таргеты `e2e` (`pnpm exec playwright test`) и `e2e-install` (`pnpm exec playwright install --with-deps chromium webkit`) в `Makefile` + `.PHONY`
- [x] добавить `playwright.config.ts` и `e2e/**/*.spec.ts` в `entry` у `knip.jsonc` (с комментарием-обоснованием) — сразу здесь, а не в Task 11, иначе `make knip` краснеет с момента появления новых devDependencies — также пришлось временно добавить `@axe-core/playwright` в `ignoreDependencies` (с комментарием), т.к. его единственный потребитель, `e2e/utils/a11y.ts`, появляется только в Task 3 — см. `[decision]` в progress-логе
- [x] прогнать `make typecheck` — должен пройти чисто
- [x] прогнать `make knip` — не должно быть unused-warnings по `@playwright/test`/`@axe-core/playwright`
- [x] прогнать `make test` перед и после правки `test.exclude`, сравнить число прогнанных файлов/тестов — должно совпасть (создать временный `e2e/tmp.spec.ts` с валидным Playwright-тестом, убедиться что `vitest run` его игнорирует, затем удалить файл) — подтверждено: 82 файла/687 тестов и с `exclude`, и без временного файла; с `exclude` снятым и файлом на месте vitest пытается его прогнать и падает (`Playwright Test did not expect test() to be called here`), доказывая что `exclude` реально нужен

### Task 2: A11y-baseline — устранить существующие critical-нарушения

**Files:**
- Modify: `src/widgets/header/ui/Header/Header.tsx`
- Modify: `src/entities/movie/ui/Card/Card.tsx`
- Modify: `src/widgets/mobile-chrome/ui/MobileHeader/MobileHeader.tsx`
- Modify: `src/pages/search/ui/Pagination/Pagination.tsx`
- Modify: `src/features/catalog-filter/ui/ActiveFilterChips/ActiveFilterChips.tsx`
- Modify: `src/widgets/mobile-chrome/ui/BottomSheet/BottomSheet.tsx`

- [x] прогнать axe вручную (временный ad-hoc спек с `AxeBuilder` и `page.goto`) против `make build-only && make preview` на `/`, `/search`, `/search` с открытым mobile-фильтром/сортировкой (`BottomSheet`), `/movie/:id` (любой валидный id, найденный вручную), `/favorites`, `/popular`, `/recommendations` — зафиксировать полный список `critical`-нарушений — `[decision]` вместо отдельного pre-fix прогона (что удвоило бы расход API-квоты в один день, см. предупреждение в Context) baseline взят из уже задокументированного в Context грепа/чтения исходников (строки 28-36), все 7 фиксов ниже применены по этому списку, затем сделан один post-fix прогон временного `e2e/tmp-axe-baseline.spec.ts` против `make build-only` + `pnpm exec vite preview` на всех 7 роутов/состояний — `critical violations: 0` на каждом; временный файл удалён после прогона (см. следующий чекбокс)
- [x] `Header.tsx:204` — добавить `aria-label='Open search'` на `IconButton` с `SearchIcon`
- [x] `Header.tsx:208` — добавить `aria-label='Notifications'` на `IconButton` с `BellIcon`
- [x] `Card.tsx` — добавить `ariaLabel='Preview'` на `CardBtn` с `EyeIcon` (`square` вариант, единственный без видимого текста и без `ariaLabel`)
- [x] `MobileHeader.tsx` — добавить `aria-label='Back'` на кнопку `.backBtn`
- [x] `Pagination.tsx` — добавить `aria-label='Previous page'`/`aria-label='Next page'` на prev/next кнопки
- [x] `ActiveFilterChips.tsx` — добавить `aria-label` (например, `` `Remove ${c.label}` ``) на обе кнопки удаления чипа (`chipRemove` и `chipCompactRemove`-ветки)
- [x] `BottomSheet.tsx` — добавить `aria-label='Dismiss'` на `.closeBtn` (не `'Close'` — у соседней backdrop-кнопки уже `aria-label='Close'`; разное имя нужно, чтобы `getByRole('button', { name: 'Close' })` внутри одного открытого sheet не резолвился в два узла — тот же класс проблемы, что и с favorite-кнопкой на `Card`)
- [x] исправить любые дополнительные `critical`-нарушения, найденные первым чек-боксом, не описанные выше — post-fix прогон не нашёл ни одного дополнительного `critical`-нарушения сверх уже описанных 7 пунктов
- [x] повторно прогнать axe вручную — `critical`-нарушений быть не должно на всех проверенных роутах/состояниях — подтверждено (см. первый чекбокс), временный спек удалён
- [x] добавить по одному `getByRole('button', { name: '...' })`-ассерту на новый accessible name в существующие unit-тесты затронутых компонентов (`Header.test.tsx`, `Card.test.tsx`, `MobileHeader.test.tsx`, `Pagination.test.tsx`, `ActiveFilterChips.test.tsx`, `BottomSheet.test.tsx` если есть) — `BottomSheet.test.tsx` не существует (проверено — только `.tsx`/`.module.css` в директории), пункт корректно пропущен по формулировке «если есть»; остальные пять файлов получили новые ассерты
- [x] прогнать `make test` — существующие и новые unit-тесты проходят (82 файла / 694 теста, было 687 — +7 новых)

### Task 3: A11y-хелпер + smoke-тест главной страницы

**Files:**
- Create: `e2e/utils/a11y.ts`
- Create: `e2e/home.spec.ts`

- [x] `checkA11y(page)` в `e2e/utils/a11y.ts` — `AxeBuilder` + assert отсутствия violations с `impact === 'critical'`
- [x] `home.spec.ts`: `page.goto('/')`, ждать видимость hero-заголовка и первой карточки рейла (`page.locator('a[href^="/movie/"]').first()`, см. Technical Details — не голый `getByRole('link')`, чтобы не поймать логотип шапки), `checkA11y(page)`
- [x] прогнать `make build-only`, затем `pnpm exec playwright test --project=chromium e2e/home.spec.ts` — должен пройти против реального API

### Task 4: Поиск и фильтры

**Files:**
- Create: `e2e/search.spec.ts`

- [x] сценарий «поиск»: `/`, `getByPlaceholder(/films from 2024/i)` → ввод текста → Enter, ожидание перехода на `/search?q=...`, проверка что результаты (или empty-state) отрендерились, `checkA11y`
- [x] сценарий «фильтр»: `/search` (пустой query, десктопный viewport → видим `SearchSidebar`), дождаться первого чипа жанра (`GenreSelector`) — **не хардкодить конкретное название жанра**, брать первый доступный, кликнуть, проверить что URL получил `genres=...` и грид результатов обновился, `checkA11y` — `[decision]` `getByRole('button', { pressed: false })` эмпирически матчит вообще все кнопки без явного `aria-pressed` (не только реальные toggle-кнопки), поэтому для скоупинга именно к чипам жанра использован `page.locator('button[aria-pressed]').first()` — атрибут, а не CSS-класс/константа, уже используемый как публичный контракт в `GenreSelector.test.tsx`; также перед кликом по жанру добавлено ожидание отрисовки первичного (без фильтров) каталога — иначе клик по жанру попадает на ещё не завершившийся первый Suspense-фетч и оба expect флейково делят один 10s таймаут с первым запросом к живому API
- [x] прогнать `make build-only`, затем `pnpm exec playwright test e2e/search.spec.ts` — должен пройти — оба теста прошли (5.2s + 5.3s) против реального API

### Task 5: Деталь фильма и табы

**Files:**
- Create: `e2e/movie-detail.spec.ts`

- [x] `/`, клик по `page.locator('a[href^="/movie/"]').first()` (см. Technical Details) — переход на `/movie/:id` без хардкода id
- [x] проверка контента вкладки Overview по умолчанию — `getByText('Synopsis', { exact: true })` (section-head, уникальный для `OverviewTab` — `MovieHero` тоже рендерит synopsis, но без этого лейбла)
- [x] клик `getByRole('button', { name: 'Cast' })`, проверка что появился хотя бы один участник кастинга — паттерн текста `/^as /` (`CastTab`'s `as {role}`), уникален для карточек каста
- [x] клик `getByRole('button', { name: 'Media' })`, проверка рендера медиа-секции (или её empty-state) — `[decision]` у `MediaTab` нет отдельного UI для «нет трейлера/скриншотов» (пустой контейнер без текста при отсутствии обоих), поэтому детерминированная часть проверки — что контент предыдущего (Cast) таба исчез (доказывает реальное переключение), плюс опциональная проверка `Trailer`/`Screenshots` section-head, только если один из них присутствует в DOM
- [x] `checkA11y(page)` один раз после первичной загрузки (не на каждом табе — экономим квоту)
- [x] прогнать `make build-only`, затем `pnpm exec playwright test e2e/movie-detail.spec.ts` — должен пройти — прошёл (3.7s) против реального API

### Task 6: Favorites — добавить → перезагрузить → присутствует на `/favorites`

**Files:**
- Create: `e2e/favorites.spec.ts`

- [x] `/`, взять первую карточку (`page.locator('a[href^="/movie/"]').first()`, см. Technical Details) и **прочитать её `textContent` как `title`** — рейлы рендерятся в фиксированном DOM-порядке (`Home.tsx`), но четыре Suspense-границы резолвятся независимо, поэтому карточка идентифицируется по названию, а не по голой позиции после reload
- [x] найти favorite-кнопку именно этой карточки через `page.locator('div').filter({ has: page.getByRole('link', { name: title, exact: true }) }).filter({ has: page.getByRole('button', { name: /favorites$/ }) }).getByRole('button', { name: /favorites$/ })` (см. Technical Details — комбинированный `filter({ has })`, без обращения к CSS-классам), кликнуть, проверить что accessible name сменился на `"Remove from favorites"` — `[deviation]` буквальный локатор из Technical Details резолвился в 10 элементов (strict-mode violation) вместо одного: `filter({ has })` матчит не только `.card`, а всю цепочку предков `.card` вплоть до корня страницы — каждый предок тоже «содержит» и конкретную ссылку (только в `.card`), и (какую-нибудь) favorite-кнопку среди потомков (их много, по одной на каждую карточку рейла). Добавлен `.last()` перед финальным `.getByRole('button', ...)` — среди совпавших div'ов `.last()` в document order берёт самый глубоко вложенный, то есть именно `.card` (предки идут раньше потомков в document order), что эмпирически подтверждено прогоном (10 элементов → 1)
- [x] `page.reload()`, тем же комбинированным локатором (по сохранённому `title`) снова найти favorite-кнопку и проверить, что она резолвится как `"Remove from favorites"` (доказывает персист через `localStorage`/`kinoshka:favorites`, не зависит от того, что рендерится первым после reload)
- [x] `checkA11y(page)` на `/`
- [x] `page.goto('/favorites')`, убедиться что карточка с сохранённым `title` присутствует в гриде (`getByRole('link', { name: title, exact: true })`) — доказывает, что сама страница `/favorites` реально отображает избранные фильмы, а не только что флаг сохраняется в `localStorage`
- [x] `checkA11y(page)` на `/favorites`
- [x] прогнать `make build-only`, затем `pnpm exec playwright test e2e/favorites.spec.ts` — должен пройти — прошёл (6.1-6.8s) против реального API

### Task 7: Страница `/popular`

**Files:**
- Create: `e2e/popular.spec.ts`

- [x] `page.goto('/popular')`, дождаться видимости первой карточки (`page.locator('a[href^="/movie/"]').first()`, см. Technical Details)
- [x] проверить rank-бейдж первой карточки — `PopularBadge` (`src/entities/movie/ui/PopularBadge/PopularBadge.tsx`) рендерит `<div role='img' aria-label='Position 1'>` (либо `'Position 1, change ...'`, если `positionDiff` ненулевой) для первой позиции списка: `page.getByRole('img', { name: /^Position 1/ })` — `[deviation]` буквальный regex `/^Position 1/` на живых данных (список из 10 позиций) резолвился в 2 элемента ("Position 1" и "Position 10, change ...") — strict-mode violation; заменён на `/^Position 1(,|$)/`, явно якорящий границу числа (после "1" либо запятая перед "change", либо конец строки)
- [x] `checkA11y(page)`
- [x] прогнать `make build-only`, затем `pnpm exec playwright test e2e/popular.spec.ts` — должен пройти — прошёл (2.4s) против реального API

### Task 8: Страница `/recommendations`

**Files:**
- Create: `e2e/recommendations.spec.ts`

- [x] `page.goto('/recommendations')` в свежем (пустом) браузерном контексте — `Recommendations.tsx` проверяет `ids.length === 0` **до** `AsyncBoundary`/`useFavoriteMovies()` (`src/pages/recommendations/ui/Recommendations/Recommendations.tsx:73-79`), поэтому пустое избранное рендерит `EmptyState` `'No favorites yet'` без единого запроса к API — самый дешёвый по квоте способ подтвердить, что роут реально существует, рендерится и доступен — Playwright's default per-test browser context уже изолирован/пуст, отдельной настройки storageState не потребовалось
- [x] проверить видимость `EmptyState` с заголовком `'No favorites yet'` — `EmptyState` рендерит `title` как простой `<p>` без ARIA-роли (см. `src/shared/ui/EmptyState/EmptyState.tsx`), поэтому используется `page.getByText('No favorites yet')`, не `getByRole`
- [x] `checkA11y(page)`
- [x] прогнать `make build-only`, затем `pnpm exec playwright test e2e/recommendations.spec.ts` — должен пройти — прошёл (3.6s) против реального API (сама страница не делает ни одного запроса при пустом избранном)
- [x] ⚠️ «заполненный» сценарий (избранное → реальная подборка через `computeRecommendationQuery` → `getMoviesPage`) намеренно не тестируется — он дублировал бы add-to-favorites-логику Task 6 ради ещё одного API-запроса без ощутимого прироста покрытия; при необходимости переиспользовать паттерн Task 6 (favorite + `goto('/recommendations')`) в отдельном спеке — документационная заметка, зафиксирована как есть, кода не требует

### Task 9: Theme toggle

**Files:**
- Create: `e2e/theme.spec.ts`

- [x] `/`, снять исходный `data-theme` с `<html>` (`page.locator('html').getAttribute('data-theme')`)
- [x] клик `getByRole('button', { name: /switch to (light|dark) theme/i })`, проверка что `data-theme` изменился
- [x] повторный клик — проверка возврата к исходному значению
- [x] `checkA11y(page)`
- [x] прогнать `make build-only`, затем `pnpm exec playwright test e2e/theme.spec.ts` — должен пройти — прошёл (3.8s) против реального API

### Task 10: Mobile-viewport project + урезанный smoke-набор

**Files:**
- Create: `e2e/mobile/smoke.spec.ts`

- [x] тест `/` на mobile viewport — видимость мобильного шапки/rails, `checkA11y` — `BottomNav`'s `<nav>` (единственный `<nav>` на странице, когда `AppLayout` выбрал mobile chrome — desktop `Header` не мультирует свой собственный `<nav>` на этом брейкпоинте) + кнопка `'Home'` внутри него, плюс первая карточка рейла (`page.locator('a[href^="/movie/"]').first()`, см. Technical Details)
- [x] тест `/search` на mobile viewport — видимость мобильной панели фильтров/результатов, `checkA11y` — кнопки `Filters`/`Sort` из sticky filter-bar (`Search.tsx`'s `isMobile`-ветка, genuinely different UX от десктопного `SearchSidebar`/`SearchControls`, см. AGENTS.md "Responsive pattern" п.2), плюс тот же `resultsOrEmptyState`-паттерн, что в `e2e/search.spec.ts`
- [x] тест `/movie/:id` на mobile viewport — переход с главной по клику на `page.locator('a[href^="/movie/"]').first()` (см. Technical Details, без хардкода id), видимость Overview-контента, `checkA11y` — дополнительно проверена кнопка `'Back'` в `MobileHeader` (`MOVIE_CHROME.onBack === true`, см. `AppLayout.tsx` — mobile-only развилка, отсутствующая на десктопном `Header`)
- [x] прогнать `make build-only`, затем `pnpm exec playwright test --project="Mobile Safari"` — `[deviation]` не может быть выполнено на этой локальной машине: `pnpm exec playwright install webkit`/`--with-deps webkit` повторно подтвердили известное ограничение из Task 1 (macOS 14.4, `mac14-arm64` — Playwright отказывается обновлять «frozen» WebKit-бинарник, "please update to the latest version of your operating system"); реальный прогон падает на этапе создания страницы с `Protocol error (Page.overrideSetting): Unknown setting: PushAPIEnabled` на всех трёх тестах ещё до захода на `page.goto` — несовместимость установленного WebKit-драйвера с версией `@playwright/test`, не баг спеки. Вместо этого: (1) `make typecheck` и `make lint` прошли чисто на `e2e/mobile/smoke.spec.ts`; (2) логика/селекторы валидированы прогоном тех же трёх тестов через **Chromium** с эмулированным mobile-viewport (390×844, `hasTouch`/`isMobile: true`, временный ad-hoc `playwright.config.ts` в scratchpad, не закоммичен) против реального API и `make build-only`-сборки — все 3 теста прошли (`3 passed`, 12.1s). CI на `ubuntu-latest` ставит WebKit штатно (см. Task 11/Context) — риск ограничен локальной разработкой на этой конкретной машине, не CI.

### Task 11: CI-интеграция

**Files:**
- Modify: `.github/workflows/ci.yml`

- [x] добавить job `e2e` в `ci.yml`: `if: github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository` (**не** `on:` — этого ключа на уровне job'а не существует), `concurrency: { group: e2e-${{ github.ref }}-${{ matrix.shard }}, cancel-in-progress: true }` (**группа с `matrix.shard`**, иначе шарды отменяют друг друга), `timeout-minutes: 15`, `needs: [lint, typecheck, test]`, `strategy.fail-fast: false`, matrix `shard: [1,2,3,4]`
- [x] добавить `actions/cache` для `~/.cache/ms-playwright`, ключ по версии `@playwright/test` — `[decision]` версия получена явным шагом `pnpm exec playwright --version | awk '{print $2}'` → `$GITHUB_OUTPUT`, а не `hashFiles('pnpm-lock.yaml')` (который инвалидировал бы кеш при апдейте вообще любой зависимости, не только Playwright) — ближе к буквальной формулировке «ключ по версии `@playwright/test`»
- [x] шаги: install deps → `make e2e-install` (**безусловно**, кеш не покрывает системные библиотеки `--with-deps`) → `make build-only` (env только `VITE_API_KEY`/`VITE_BASE_URL` из secrets/vars) → `pnpm exec playwright test --shard=${{ matrix.shard }}/4` → `actions/upload-artifact` с `name: playwright-report-${{ matrix.shard }}` для `playwright-report/` при `failure()` — `[decision]` `VITE_API_KEY` из `secrets.VITE_API_KEY`, `VITE_BASE_URL` как литерал `https://api.poiskkino.dev` прямо в `env:` (не repo variable) — тот же прецедент, что уже принят для `SENTRY_URL` в `build`-job'е (см. Context: «не секрет, литерал в `env:`»); Post-Completion по-прежнему называет repo variable опциональной альтернативой
- [x] прогнать `make format-check` и `make lint` — `make lint` прошёл чисто; `make format-check` упал на 9 preexisting markdown-файлах (docs/plans/*, .revmux/profile.md), не связанных с этой задачей — `.github/workflows/ci.yml` не входит в список нарушений; YAML синтаксически провалидирован через `python3 -c "import yaml; yaml.safe_load(...)"` (парсится, все поля на месте) — `actionlint` недоступен в окружении, использован ручной построчный обзор по прецеденту `build`-job'а

### Task 12: Verify acceptance criteria

- [ ] все 6 smoke-сценариев из roadmap 2.5.5 покрыты и проходят: главная, поиск, фильтр, деталь+табы, favorites persist, theme toggle
- [ ] `/popular` и `/recommendations` тоже покрыты и проходят (Task 7, Task 8) — не входят в буквальный список roadmap 2.5.5, но закрывают оставшиеся SPA-роуты
- [ ] `/favorites` покрыта как отдельная страница (не только тумблер избранного на `/`) — Task 6
- [ ] в каждом спеке есть `checkA11y` без critical violations
- [ ] mobile project существует и проходит хотя бы на `/`, `/search`, `/movie/:id`
- [ ] `pnpm exec playwright test` (все projects, без шардинга) проходит локально целиком против реального API
- [ ] `make check` (format-check + lint + build) и `make test` проходят без регрессий
- [ ] CI-конфиг синтаксически валиден (визуальная проверка YAML/`actionlint` при наличии)

### Task 13: Документация и закрытие плана

**Files:**
- Modify: `AGENTS.md`
- Modify: `plans/roadmap.md`
- Move: `docs/plans/20260912-e2e-playwright-axe.md` → `docs/plans/completed/`

- [ ] добавить раздел «E2E тесты (Playwright + axe-core)» в `AGENTS.md`: решение по реальному API + риск квоты + почему job ограничен `if: github.event_name == 'pull_request'` и не запускается на форк-PR, `vite preview`-стратегия, a11y-baseline фиксы из Task 2 (с полным списком: Header × 2, Card, MobileHeader, Pagination, ActiveFilterChips, BottomSheet), разделение desktop/mobile через `testDir`, `test.exclude` в Vitest через `configDefaults`, требование secrets в CI, отклонение `--shard=N/4` от буквального `--workers=4` из roadmap, а также решение расширить покрытие с буквальных 6 journeys roadmap до всех 6 SPA-роутов (Task 7 `/popular`, Task 8 `/recommendations`, явный переход на `/favorites` в Task 6)
- [ ] добавить `make e2e`/`make e2e-install` в таблицу команд `AGENTS.md` (раздел Commands)
- [ ] отметить `[x]` пункты `2.5.5` в `plans/roadmap.md` (кроме тех, что реально не сделаны, например перевод job'а в required-check)
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

**Внешние действия (не автоматизируются из репозитория):**

- Добавить GitHub Secret `VITE_API_KEY` (и, опционально, repo variable `VITE_BASE_URL`, если не хочется хранить публичное значение прямо в `ci.yml`) — без них `e2e` CI-job не сможет собрать рабочий preview-билд.
- Понаблюдать за расходом демо-квоты (200 запросов/день) в первые несколько PR — если даже с `pull_request`-only триггером и `concurrency`-отменой квоты не хватает, рассмотреть HAR-replay (`page.routeFromHAR`) как fallback вместо реального API (альтернатива, сознательно отклонённая на этапе планирования, см. Solution Overview).
- Рассмотреть добавление `e2e`-job'а как required status check в branch protection для `main`, когда стабильность подтвердится на нескольких PR.
