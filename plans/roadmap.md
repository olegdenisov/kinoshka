# План реализации Kinoshka — Middle → Senior roadmap

## Context

Проект — каталог фильмов/сериалов/анимации на React 19 + TS + Vite + FSD. Цель — продемонстрировать архитектурную зрелость уровня Senior. Текущее состояние `main`: UI-каркас полностью собран, но все данные — мок (`CATALOG` из `@entities/movie`), фильтры/поиск/пагинация — нефункциональный shell, нет global state, нет favorites/theme/popular. API-клиент (`src/shared/api/client.ts`) настроен и получает `X-API-KEY` (Phase 0 сделана), но ни один компонент ещё не переведён на реальные данные — это задача Phase 1.

В ветке `rtk` уже сделан фундамент: configureStore + RTK Query + `sdkBaseQuery` (обёртка над apicraft SDK) + endpoints `getMovies/getGenres` + URL-sync фильтров.

**Цель плана** — дать roadmap по фазам, который ты последовательно реализуешь на `main`, а затем повторно применишь в ветках для сравнения state-libs, SSR-фреймворков и подходов к auth. Под каждой задачей — короткая заметка «как лучше реализовать». Все пункты — с чекбоксами для отслеживания прогресса.

---

## Прогресс (живой трекер)

Обновляй галочки по мере выполнения. Сводка статуса по фазам:

- [ ] **Phase 0** — Foundation (включая CI/CD, pre-commit, a11y-lint, security baseline)
- [ ] **Phase 1** — MVP на API (с React 19 Suspense/use/useTransition)
- [ ] **Phase 2** — Advanced-фичи (с useOptimistic для favorites)
- [ ] **Phase 2.5** — Pre-launch readiness (Sentry, CSP, E2E, performance budgets)
- [ ] **Phase 3** — State-libs ветки (multi)
- [ ] **Phase 4** — SSR ветки (multi)
- [ ] **Phase 5** — Auth/BFF ветки (multi) + monorepo + Docker
- [ ] **Phase 6** — Scaling & product polish (Storybook, ADRs, i18n, PWA, visual regression)

**Логика порядка:** соответствует real-world timing — что в продакшен-команде делается на каждом этапе. CI/lint/a11y-baseline ставятся сразу. Observability/Sentry/E2E — перед публичным релизом (иначе нет данных и тесты ломаются). Storybook/ADR/i18n/PWA — когда стек устоялся и есть конкретное требование. Monorepo/Docker — когда появляется второй пакет (BFF).

---

## Фаза 0. Foundation (на `main`, общая база)

База, которая нужна всем последующим фазам и веткам. Делается один раз.

### 0.1 Авторизация API (`X-API-KEY`)

- [x] Создан `src/shared/api/client.ts` с singleton `new ApiInstance({ headers: { 'X-API-KEY': ... } })`.
- [x] Env переименованы в `VITE_*` (`VITE_API_KEY`, `VITE_BASE_URL`).
- [x] `.env.example` добавлен в репо.
- [x] `apicraft.config.ts` использует отдельную переменную для генерации.
- [x] Все импорты `instance` идут через `client.ts`, а не напрямую из `instance.gen.ts`.

**Как лучше:** `instance.gen.ts` — авто-генерируемый, править нельзя. `ApiInstance` принимает `FetchesParams` (объект из `@siberiacancode/fetches`) — передавай туда `headers` и `baseURL`. Не клади ключ в bundle напрямую — это временное решение, в фазе 5 (BFF) ключ переедет на сервер.

**📚 Refs:**

- Vite env vars: https://vite.dev/guide/env-and-mode
- siberiacancode/fetches: https://github.com/siberiacancode/fetches

### 0.2 Универсальные UI-состояния (`src/shared/ui/`)

- [x] `Spinner` — CSS-only через `@keyframes`.
- [x] `Skeleton` — шиммер (использует `shimmer` keyframe из `global.css`).
- [x] `EmptyState` — пустой результат.
- [x] `ErrorState` — ошибка + retry-кнопка.
- [x] `ErrorBoundary` (классовый — единственное оправданное место) + дефолтный fallback.
- [x] `AsyncBoundary` — wrapper-компонент, инкапсулирующий loading/error/empty/children.

**Как лучше:** один `<AsyncBoundary>` вместо ручного `if loading / if error / if empty / else` в каждом компоненте — не дублируешь код. С React 19 + Suspense это становится `<Suspense fallback={<Skeleton/>}><ErrorBoundary fallback={<ErrorState/>}>{children}</ErrorBoundary></Suspense>` — больше не нужны `isLoading`/`error` пропы.

**📚 Refs:**

- React Suspense: https://react.dev/reference/react/Suspense
- react-error-boundary: https://github.com/bvaughn/react-error-boundary
- React 19 use(): https://react.dev/reference/react/use

### 0.3 Тесты (Vitest + Testing Library)

- [x] `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom`.
- [x] `vite.config.ts` → секция `test: { environment: 'jsdom', setupFiles, globals: true }`.
- [x] `make test` в `Makefile`.
- [x] `src/test/setup.ts` с `@testing-library/jest-dom/vitest`.
- [x] Минимум один проходящий smoke-тест.
- [x] `pnpm add -D msw` — для integration-тестов, мокающих API на сетевом уровне (единственное оправданное место моков, см. ниже).

**Как лучше:** не тестируй UI mock-ами — тестируй pure functions (фильтры, selectors, recommendations rule). Для компонентов — только smoke + accessibility через `user-event`. MSW (Mock Service Worker) для мокирования API на integration-уровне — единственное место, где моки оправданы.

**📚 Refs:**

- Vitest: https://vitest.dev/guide/
- React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
- MSW: https://mswjs.io/docs/

### 0.4 Абстракция над localStorage

- [x] `src/shared/lib/storage.ts` — `createStorageSlot<T>(key, schema)`.
- [x] Zod-валидация при чтении.
- [x] Подписка через `window.storage` event (синк между табами).
- [x] Тест на edge cases (невалидный JSON, отсутствие ключа, mismatched schema).

**Как лучше:** zod-схема закрывает edge case «несовпадение схем данных» из `plans/main.md` 3.4. Используй `useSyncExternalStore` чтобы React-компоненты подписывались на storage event — это нативный API для интеграции внешних store с React.

**📚 Refs:**

- Zod: https://zod.dev/
- useSyncExternalStore: https://react.dev/reference/react/useSyncExternalStore
- MDN storage event: https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event

### 0.5 Feature Flags (`src/shared/config/features`)

- [x] Статический объект с типом `Record<FeatureName, boolean>`.
- [x] Хук `useFeatureFlag(name)`.
- [x] Опционально: компонент-обёртка `<FeatureGate name="...">`.

**Как лучше:** не привязывай к env — пусть будет в коде, чтобы переключать локально. Позже можно подменить source без изменения сигнатуры.

### 0.6 CI/CD baseline (GitHub Actions)

- [x] `.github/workflows/ci.yml`: lint + typecheck + test + build на каждый PR и push в main.
- [x] Кэширование `node_modules` / pnpm store (`actions/cache` или `pnpm/action-setup` с встроенным кэшем).
- [x] Branch protection на `main`: required checks, no direct push.
- [x] PR template `.github/pull_request_template.md` (что поменялось / почему / how to test).
- [x] Deploy preview per PR (Vercel или Netlify, free tier — оба подходят для SPA).
- [ ] FSD-линтер (`steiger` или `eslint-plugin-boundaries`) в CI — автоматически проверяет направление импортов `pages → widgets → features → entities → shared`, а не только дисциплиной ревью.
- [x] Бейджи статуса в README.

**Как лучше:** PR-чек должен быть быстрый (< 3 мин), иначе никто не ждёт. Параллель jobs: lint, typecheck, test — отдельные jobs, не последовательно. Build — отдельно, в конце. Использовать `actions/setup-node@v4` + `cache: 'pnpm'` для авто-кэширования.

**📚 Refs:**

- GitHub Actions для Node: https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-nodejs
- pnpm в CI: https://pnpm.io/continuous-integration
- Vercel CLI deploy: https://vercel.com/docs/deployments/git
- Branch protection: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches

### 0.7 Pre-commit hooks + commit conventions

- [x] `pnpm add -D husky lint-staged @commitlint/cli @commitlint/config-conventional`.
- [x] `husky init` → `.husky/pre-commit` запускает `lint-staged`.
- [x] `lint-staged` в `package.json`: только staged-файлы (`eslint --fix --max-warnings=0`). Prettier не используется — форматирование через ESLint-правила.
- [x] ESLint-правило `no-console` (error, кроме `warn`/`error`) — без него `console.log` не блокируется pre-commit hook (см. Verification Phase 0).
- [x] `.husky/commit-msg` запускает `commitlint`.
- [x] `commitlint.config.js` extends `@commitlint/config-conventional`.
- [x] Опционально: `pnpm dlx commitizen init` для интерактивных коммитов.

**Как лучше:** не запускай весь lint/test в pre-commit — слишком медленно, разработчики начнут использовать `--no-verify`. Только staged-файлы через `lint-staged`. Полный test/typecheck — в pre-push или CI. Commitlint конфигурация: `extends: ['@commitlint/config-conventional']` — типы `feat/fix/docs/refactor/test/chore` + scope = название FSD-слоя.

**📚 Refs:**

- Husky: https://typicode.github.io/husky/
- lint-staged: https://github.com/lint-staged/lint-staged
- commitlint: https://commitlint.js.org/guides/getting-started.html
- Conventional Commits: https://www.conventionalcommits.org/ru/v1.0.0/

### 0.8 A11y baseline

- [x] `pnpm add -D eslint-plugin-jsx-a11y`.
- [x] Подключить в eslint config (`plugin:jsx-a11y/recommended`).
- [x] Проходка по существующим компонентам: все `div onClick` заменены на `<Link>` (навигация) или `<button>` (действие); lint чистый.
- [x] Smoke keyboard nav: открой каждую страницу с клавиатуры (Tab/Enter/Esc) — все интерактивы доступны.
- [x] Focus-visible стили в `global.css` (`:focus-visible { outline: 2px solid var(--accent-warm); }`).

**Как лучше:** включай линтер с первого дня — переписывать a11y потом дороже на порядок. `jsx-a11y` ловит 80% типичных проблем автоматически. Для интерактивов без явной семантики (`<div onClick>`) — заменяй на `<button>` (получишь focus/keyboard/screen reader бесплатно).

**📚 Refs:**

- eslint-plugin-jsx-a11y: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
- WAI-ARIA Authoring Practices: https://www.w3.org/WAI/ARIA/apg/
- A11y Project checklist: https://www.a11yproject.com/checklist/
- :focus-visible: https://developer.mozilla.org/en-US/docs/Web/CSS/:focus-visible

### 0.9 Security baseline

- [x] Pre-commit hook `gitleaks` (или `trufflehog`) — блокировать коммиты с секретами.
- [x] `Dependabot` или `Renovate` config (`.github/dependabot.yml`) — weekly PR с обновлениями зависимостей.
- [x] `pnpm audit --audit-level high --prod` в CI (fail на high+).
- [x] `.env.local` точно в `.gitignore`, `.env.example` с пустыми значениями в репо.
- [x] CodeQL action `.github/workflows/codeql.yml` (бесплатно для public-репо).

**Как лучше:** Renovate гибче Dependabot (group updates, schedules, лучше для монорепо). Для одного frontend-репо — Dependabot достаточен. CodeQL — статический анализ от GitHub, ловит security-bugs в TS-коде. Проект на pnpm, а не npm — используется `pnpm audit`, не `npm audit`. Флаг `--prod` нужен, т.к. `apicraft` (codegen-тул, `devDependencies`) тянет транзитивные high/critical уязвимости (handlebars, tar), которые не попадают в рантайм-бандл и не должны блокировать CI. Альтернатива ручному `codeql.yml` — включить CodeQL Default Setup в настройках репозитория на GitHub (без workflow-файла). `cooldown.default-days: 30` в `dependabot.yml` — не предлагать обновление, пока новая версия не «отлежалась» 30 дней (security-обновления это ограничение игнорируют).

**📚 Refs:**

- gitleaks: https://github.com/gitleaks/gitleaks
- Dependabot: https://docs.github.com/en/code-security/dependabot
- Renovate: https://docs.renovatebot.com/
- CodeQL для JS/TS: https://codeql.github.com/docs/codeql-language-guides/codeql-for-javascript/

---

## Фаза 1. MVP-фичи на реальном API (на `main`, без global state)

**React 19 заметка:** все новые async-хуки в этой фазе сразу пиши через Suspense + `use()`, а не `useEffect + useState`. Это даст естественную интеграцию с `<AsyncBoundary>` (0.2 — оборачивает `<Suspense fallback={...}>` + `<ErrorBoundary>`). Фильтры/поиск — через `useTransition` для non-blocking updates.

Цель — переход с мока на API без введения state-менеджера. Использовать пока хуки + `useState`/`useReducer`.

### 1.1 Каталог на главной с реальным API

- [x] `src/entities/movie/api/getMovies.ts` — обёртка над `instance.getV15Movie(...)` с маппингом DTO → `Movie`.
- [x] Хук `useTopRatedMovies()` (sortField=rating.kp, sortType=-1).
- [x] Хук `useNewMovies()` (year=current).
- [x] `HomeDesktop`: rails используют новые хуки, `CATALOG` удалён из импортов на главной (desktop; `HomeMobile` остаётся на `CATALOG` до 2.5).
- [x] Skeleton при загрузке rails.
- [x] Обработка rate limit: API возвращает **403** (не 429) при исчерпании суточного лимита — isError-кэш с cooldown 20с в `getMovies.ts` + нормализация сообщения в interceptor (коммит ccddf08).
- [x] Dev-кэш ответов в `sessionStorage` (переживает reload/HMR) — текущий in-memory `Map` умирает при каждой перезагрузке и выжигает квоту 200 запросов/сутки при разработке.
- [x] Перетипизировать `RequestParams` в `getMovies.ts` с V14 на V15: реальный эндпоинт `/v1.5/movie` — курсорная пагинация (`next`/`prev`), параметра `page` там нет.

**Как лучше:** не тащи всё в один хук. Узкие хуки — в фазе 3 они станут endpoints/atoms/queries без изменения API на уровне UI. С React 19 use(): `const movies = use(moviesPromise)` внутри Suspense — функции возвращают promise, компонент его читает. Дедупликация запросов: внешний кэш `const cache = new Map<string, Promise>()` (примитивный, но работает до Phase 3).

**Ограничения demo-тарифа (poiskkino.dev, бывший kinopoisk.dev):** 200 запросов/сутки; `limit ≤ 10`; доступны только страницы 1–10. Превышение лимита приходит как **403** с телом `{ statusCode, message, error }` (`ForbiddenErrorResponseDto` в `types.gen.ts`), статуса 429 у API нет — errors-тип `getV15Movie` описывает только 400/401/403. Нюанс выборки: `useNewMovies` с `year=[текущий]` + жёсткий фильтр `rating.kp: 7-10` + `notNullFields` по постерам/рейтингам в первой половине года даёт тощий результат — надёжнее диапазон `«{prev}-{current}»`.

**📚 Refs:**

- React use(): https://react.dev/reference/react/use
- Suspense patterns: https://react.dev/reference/react/Suspense#displaying-a-fallback-while-content-is-loading

### 1.2 Поиск с debounce

- [x] `getSearchMovies({query, page})` — обёртка над `instance.getV15MovieSearch` (миграция с v1.4 — коммит `2b25be6`), маппинг `SearchMovieDtoV14 → Movie` с fallback `name ?? alternativeName ?? enName` и placeholder-постером (у search-эндпоинта нет `notNullFields`/`selectFields` — записи без постера/рейтинга не отсечь на сервере).
- [x] Кэш промисов + sessionStorage (переиспользовать паттерн из `getMovies.ts`) — для `use()` это не оптимизация, а условие работоспособности (нестабильный промис = бесконечный цикл fetch); бонусом решает race conditions и дедуплицирует повторный набор.
- [x] Debounce 250ms **до** записи в URL, чтение результата через `use()` + Suspense — реализовано без отдельного хука `useSearch`: `Header` дебаунсит инпут через `useDebouncedValue` и пишет `?q`, `useMovieCatalog` (page-слой, `src/pages/search/model/`) читает URL и вызывает `use(getSearchMovies(...))`/`use(getMoviesPage(...))` внутри `<AsyncBoundary>`; `useSearch` как отдельная сущность не заведён и позже удалён (см. 1.3/Task 9 плана url-sync).
- [x] `useDeferredValue` для рендера — реализовано в `useCatalogUpdateStatus` (`src/pages/search/model/useCatalogUpdateStatus.ts`, план `docs/plans/20260806-search-loading-indicator-and-filter-reset.md`): `query`/`filters`/`sort`/`page` зеркалятся в локальный `useState` (эффект вне transition-области react-router, см. докблок хука — `setSearchParams` иначе оборачивает апдейт в `startTransition`, и `useDeferredValue` не стадирует значение), затем один `useDeferredValue` над объединённым объектом. `SearchResults`/`MobileSearchResults` рендерятся от `deferred*`, старые данные остаются на экране (не skeleton), пока `isUpdating` — лёгкий бейдж «Updating…» поверх приглушённого (`opacity`) блока результатов; `Pagination`/`MobilePagination` при этом получают live `displayPage`, а не deferred, чтобы клик по номеру страницы подсвечивался мгновенно.
- [x] URL-sync через `useSearchParams()` (`?q=...`), запись с `replace: true`; поисковый инпут в `Header` связан с URL (`src/widgets/header/ui/Header/Header.tsx`).
- [x] Два режима `/search`: есть `q` → `/v1.5/movie/search` (`getSearchMovies`, миграция с v1.4 — коммит `2b25be6`), нет `q` → каталожный эндпоинт с фильтрами (`getMoviesPage`, см. 1.3) — реализовано как `useMovieCatalog`. Вход в текстовый поиск не просто дизейблит сайдбар/сортировку визуально — `usePageSync` (`src/pages/search/model/usePageSync.ts`) атомарно зачищает `type`/`genres`/`yearFrom`/`yearTo`/`rating`/`sort` из URL через `stripFilterAndSortParams` (Variant A — API не сочетает текстовый поиск с фильтрами), и на смене `'' → непустой query`, и на deep-link/refresh сразу в search-режиме с уже проставленными фильтрами.
- [x] Min length 2 + `trim` — `Header.tsx` (`QUERY_MIN_LENGTH = 2`), пустой/короткий запрос не пишется в `?q`.
- [x] Хиро-поиск главной страницы (`HeroSection`, `/`) — вторая точка входа в `/search`: собирает `URLSearchParams` через `filtersToSearchParams`/`EMPTY_FILTERS` (`@features/catalog-filter`) и гейтит `q` тем же `QUERY_MIN_LENGTH` (`@widgets/header`), что и `Header`, — общий контракт «поиск → URL» вместо дублирования магических чисел/литералов. В отличие от `Header`, пишет URL по явному сабмиту (Enter/клик «Search»), а не live-дебаунсом при вводе. См. `docs/plans/20260814-home-hero-search-wiring.md`.
- [x] Loading/empty/error: `EmptyState` с эхом запроса («Ничего не найдено по „…“»), isError-cooldown на 403 в `getSearchMovies`/`getMoviesPage` через обобщённый `createCachedFetcher`.
- [ ] ⌘K / `/` фокусирует инпут — не реализовано, подсказка `⌘K` в `Header` остаётся визуальной, без реального хоткея.
- [x] A11y: `role="search"` на форме (`Header.tsx`), `aria-live="polite"` на счётчике результатов (`SearchDesktop`/`SearchMobile`), кнопка очистки (×) при непустом `q`.

**Как лучше:** `useDeferredValue` сам по себе не дебаунсит сетевые запросы — это про рендеринг-приоритеты. Нужен явный debounce поверх. `useTransition` для «не блокировать input при дорогом фильтрационном update». Квота demo-тарифа (200 req/сутки) выжигается поиском по мере ввода быстрее всего в приложении — debounce, min length и sessionStorage-кэш обязательны. Лимиты `limit ≤ 10` / страницы 1–10 действуют и здесь: `SearchDesktop` рассчитан на `PER_PAGE = 16` — на demo-ключе больше 10 не получить, привести сетку в соответствие.

**📚 Refs:**

- useDeferredValue: https://react.dev/reference/react/useDeferredValue
- useTransition: https://react.dev/reference/react/useTransition
- React Router useSearchParams: https://reactrouter.com/api/hooks/useSearchParams

### 1.3 Фильтры с URL-sync

- [x] `useFilterState()` расширен URL-sync (`src/features/catalog-filter/model/useFilterState.ts`, на `useSearchParams`, `replace: true`; общий для `SearchDesktop` и `SearchMobile`).
- [x] `getFilterFromSearchParams()` / `filtersToParams()` в `features/catalog-filter/lib/` (`searchParams.ts`, `filtersToParams.ts`), Zod на границе URL.
- [x] `/search` использует фильтры в запросе к API (только режим без `q`) — `useMovieCatalog` → `getMoviesPage(filtersToParams(filters, sort), page)`.
- [ ] Жанры подгружаются через `getV1MoviePossibleValuesByField({ field: 'genres.name' })` — не реализовано; вместо динамической загрузки используется статический словарь EN→RU (`src/features/catalog-filter/lib/genreMap.ts`) поверх фиксированного UI-списка `ALL_GENRES`.
- [x] Активные чипы рендерятся из URL-параметров (`ActiveFilterChips`, `activeChips` из `useFilterState`).

**Как лучше:** URL — single source of truth для фильтров (shareable links, back/forward работают). Локальный state — только для UI-черновика, если будет «Применить».

### 1.4 Пагинация

- [x] `/search` — нумерованная везде: search-режим — нативный `page`/`limit`, теперь на v1.5 (`getV15MovieSearch` уже отдаёт постраничный `pages`/`page`, а не курсор — миграция с v1.4 не потребовала эмуляции, см. `getSearchMovies`); catalog-режим — эмуляция numbered-page через курсорный обход `next` v1.5 (`getMoviesPage`, `src/entities/movie/api/getMoviesPage.ts`), не трогая общий `createCachedFetcher`/рельсы главной.
- [ ] Главная rails — `limit: 10`, без пагинации — вне рамок плана url-sync (Task 1–14 не трогали `useNewMovies`/`useTopRatedMovies`/`getMovies.ts`); `limit` там сейчас не выставлен явно, оставлено как есть.
- [x] Корректная обработка last page / total = 0 — `EmptyState` при пустом результате, `getMoviesPage` отдаёт пустой хвост при отсутствии `next`, тесты покрывают оба случая (`getMoviesPage.test.ts`).
- [x] Сохранение страницы в URL (`?page=...`) — `SearchDesktop`/`SearchMobile` читают/пишут `page` через `useSearchParams`, сброс на 1 при смене `q`/фильтров.
- [x] UI не рисует страницы дальше 10-й на demo-ключе — `MAX_PAGE = 10` clamp и на чтении из URL, и на записи (`goToPage`) в обоих вариантах страницы; `totalPages` также clamp'ится к 10 в `getMoviesPage`/`getSearchMovies`.

**Как лучше:** пагинация здесь — только для `/search` (numbered). Виртуализация (2.7) имеет смысл только для infinite scroll — не смешивай оба подхода на одной странице. ⚠️ Устарело на момент написания: ожидалось, что нумерованную пагинацию можно получить только на v1.4 (`page`/`limit`), а v1.5 — исключительно курсорный (`next`/`prev`) без `page`. По факту `getV15MovieSearch` (`/v1.5/movie/search`) отдаёт `page`/`pages` нативно — курсорный без `page` оказался только каталожный `/v1.5/movie` (см. `getMoviesPage`). На demo-тарифе жёсткий потолок: `limit ≤ 10`, страницы 1–10 → максимум 100 элементов на любую выборку.

### 1.5 Детальная страница

- [x] `apiClient.getV15MovieById(...)` подключён (не v1.4, как в исходной формулировке — на момент реализации проект уже на v1.5, см. коммит `2b25be6`), `MOCK_DETAIL` удалён (`grep -r MOCK_DETAIL src` — пусто). Детали: `docs/plans/20260807-movie-detail-page-api.md`.
- [x] Tabs: Overview, Cast, Details, Media — все четыре переведены на реальный `MovieDetail`.
- [x] Параллельные запросы через `Promise.allSettled` — реализовано как `(movie, images)`, а не `(movie, images, similar)`: `similarMovies`/`sequelsAndPrequels`/`persons` (cast+crew) оказались полями самого `MovieDtoV14`, а не отдельными эндпоинтами — единственный отдельный вызов остался за картинками (`getV15Image`). Осознанное отклонение от буквальной формулировки, зафиксировано в плане.
- [x] Skeleton при загрузке деталей — `MovieDetailSkeleton`, один вариант на оба device-типа.
- [x] 404-обработка несуществующих ID — `ApiError { status }` из `client.ts` + `AsyncBoundary.errorFallback` в `MoviePage.tsx`, различающий 404 от прочих ошибок; `/movie/666` → `ErrorState` с retry (acceptance criteria плана), покрыто `MoviePage.test.tsx`.

**Как лучше:** не делай waterfall — параллель через `Promise.allSettled` (допускаешь частичный отказ media/similar). В Suspense-стиле: дёрни оба promise сразу, передай в use() — Suspense сам разберётся с lifecycle.

**📚 Refs:**

- Promise.allSettled: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/allSettled

### 1.6 Loading / Empty / Error везде

- [x] `AsyncBoundary` (из 0.2) обёрнут вокруг каждой async-секции — главная (`HomeDesktop`, 4 рейла), `/search` (`SearchDesktop`/`SearchMobile`), `/movie/:id` (`MoviePage`); `HomeMobile` вне скоупа (моковый `CATALOG` до фазы 2.5).
- [x] Skeleton — для контентных страниц (`MovieRailSkeletonDesktop`, `SearchResultSkeletonGrid`/`MobileResultsSkeleton`, `MovieDetailSkeleton`).
- [x] Spinner — для коротких операций.
- [x] Retry-кнопки реально дёргают повторный fetch — `createCachedFetcher`/`getMoviesPage` получили точечный `invalidate`, `AsyncBoundary` получил `onRetry?: () => void` (вызывается до `reset()`, с гвардом от дабл-клика); подключено на всех трёх поверхностях (Home rails, `/search`, `/movie/:id`). Дополнительно: `MovieRailDesktop` теперь рендерит `EmptyState` при пустом результате. Детали: `docs/plans/20260814-async-boundary-retry-and-empty-states.md`.

**Как лучше:** Skeleton > Spinner для контента — UX лучше (видно структуру до загрузки).

---

## Фаза 2. Advanced-фичи (на `main`)

### 2.1 Favorites ⭐

- [x] `features/favorites/` создан, модель `{ ids: number[] }`.
- [x] Хранение через `createStorageSlot` (0.4) с zod-схемой.
- [x] Хук `useFavorites()` + actions `toggle/add/remove/clear`.
- [x] Selector `isFavorite(id)`.
- [x] Хук `useFavoriteMovies()` подгружает данные по ID (`Promise.allSettled`).
- [x] Кнопка-сердечко в `entities/movie/ui/Card` — синхронный toggle (localStorage-запись мгновенна, `useOptimistic` тут не нужен — пользу он даст только когда favorites уедут на сервер, см. 5.4). Реализовано также в `MobileCard` (паритет UX, см. `docs/plans/20260816-favorites-feature.md`).
- [x] Страница `/favorites` с пустым state.
- [x] Edge case: удалённый контент (server 404) — фильтр fulfilled.
- [x] Edge case: cross-tab sync через `storage` event.
- [x] Edge case: zod-валидация при init, fallback на пустой массив.

**Как лучше:** только ID (как в плане). Подгрузка батчем + кэширование. С глобальным state (фаза 3) станет тривиально. `useOptimistic` особенно важен на медленной сети (фаза 5, когда favorites переедут на сервер) — UI не ждёт ответа.

**📚 Refs:**

- useOptimistic: https://react.dev/reference/react/useOptimistic
- BroadcastChannel API (для cross-tab — альтернатива storage-event): https://developer.mozilla.org/en-US/docs/Web/API/BroadcastChannel

### 2.2 Theme toggle 🌙

- [x] Спроектировать светлую палитру (текущие токены — dark-only, `#0F0D11` и тёплый акцент механически не переносятся).
- [x] Светлые токены `:root[data-theme="light"] { ... }` в `global.css`.
- [x] `features/theme/`, модель `'light' | 'dark' | 'system'`.
- [x] `useTheme()` — атрибут `data-theme` на `<html>`, слушает `prefers-color-scheme` если `system`.
- [x] Persist в localStorage.
- [x] Toggle-кнопка в `Header`.
- [x] Нет FOUC (применять тему до первого рендера, inline `<script>` в `index.html`).

**Как лучше:** один атрибут на `<html>` + CSS-переменные = O(1) переключение без re-render всего дерева. FOUC решается inline-скриптом в `<head>` ДО `<body>`: читает localStorage, ставит `data-theme` синхронно. Скрипт минимальный (10 строк) — embed прямо в `index.html`.

**📚 Refs:**

- prefers-color-scheme: https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
- Theme switching no-FOUC pattern: https://www.joshwcomeau.com/react/dark-mode/
- color-scheme CSS property: https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme

### 2.3 Popular this week 🔥 — done, см. `docs/plans/20260825-popular-this-week-rail.md`

- [x] Endpoint `getV14ListBySlug({ path: { slug: 'top10-week' } })` (или аналогичный — проверь slug в spec). Реальный slug — `popular`, не `top10-week`: `GET /v1.5/list/top10-week` возвращает 404, `GET /v1.5/list/popular` — 200 (`getV15ListBySlug`, не `getV14`).
- [x] Rail на главной + страница `/popular`.
- [x] Кэш на 24h (при появлении Query-tool в фазе 3 — `staleTime: 24h`). Реализовано через кастомный `ttlMs` в `createCachedFetcher` (без Query-tool) — 24h в проде работает как in-memory кэш на время SPA-сессии, не переживает reload (persist в `sessionStorage` — только DEV, см. AGENTS.md).

**Как лучше:** агрессивный кэш — popular меняется редко.

### 2.4 Recommendations 🎯 (rule-based)

- [ ] `features/recommendations/` создан.
- [ ] Pure-функция `computeRecommendationQuery(favorites): Query` — топ-3 жанра + средний рейтинг, exclude favoriteIds.
- [ ] Юнит-тесты на pure rule.
- [ ] Хук `useRecommendations()`.
- [ ] Страница `/recommendations` с empty-state «добавь в избранное».

**Как лучше:** правило в pure-функции (тестируется в 0.3). Composition: data → pure rule → query → data.

### 2.5 Mobile-варианты

- [ ] `HomeMobile` полноценная версия (вертикальные rails).
- [ ] `SearchMobile` полноценная версия (drawer-фильтры).
- [ ] `MovieMobile` полноценная версия.
- [ ] Data-логика вынесена в `model/` и переиспользована между desktop+mobile.

**Как лучше:** не дублируй data-логику — общие хуки, различные UI-композиции.

### 2.6 Error boundaries

- [ ] Global `ErrorBoundary` (уже готов, 0.2) подключён в `app/`.
- [ ] Per-route `ErrorBoundary` в `pages/*` — используют существующий компонент, не новый.
- [ ] Fallback с retry + ссылкой на главную.

**Как лучше:** свой класс из 0.2 уже написан и работает — не заводи параллельно `react-error-boundary`, это дублирование одной и той же концепции.

### 2.8 Навигация к новым страницам

- [ ] `/favorites`, `/popular`, `/recommendations` добавлены в `Header`/`BottomNav`. ➕ `/favorites` уже сделано вместе с 2.1 (`docs/plans/20260816-favorites-feature.md`, Task 6); `/popular`/`/recommendations` ждут своих задач (2.3/2.4).

**Как лучше:** делай это сразу по мере появления каждой страницы (2.1/2.3/2.4), а не отдельным проходом в конце — иначе часть ссылок забудется.

### 2.7 Performance — virtualization

- [ ] `@tanstack/react-virtual` (либо `react-window`) для rails на главной (много карточек в DOM одновременно).
- [ ] Если `/search` перейдёт на infinite scroll (вместо нумерованной пагинации из 1.4) — виртуализация грида там же; при обычной постраничке (20-50 карточек) виртуализация избыточна.
- [ ] `<img loading="lazy" decoding="async" />` на постерах.
- [ ] Lighthouse Performance измерен до/после.

**Как лучше:** React Compiler уже мемоизирует — `useMemo`/`useCallback` НЕ добавляй (см. AGENTS.md). `IntersectionObserver` для lazy-mount тяжёлых секций (related movies, cast tab). `content-visibility: auto` в CSS для off-screen rails — браузер сам пропускает рендер невидимого.

**📚 Refs:**

- @tanstack/react-virtual: https://tanstack.com/virtual/latest/docs/introduction
- react-window: https://github.com/bvaughn/react-window
- content-visibility: https://developer.chrome.com/docs/css-ui/content-visibility
- Image loading=lazy: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/img#lazy
- React Compiler: https://react.dev/learn/react-compiler

---

## Фаза 2.5. Pre-launch readiness (на `main`, перед публичным релизом)

После Phase 2 у тебя working SPA с фичами. Прежде чем дальше углубляться в state-libs / SSR / auth — приведи в порядок то, что в реальной команде делается за 1-4 недели до публичного запуска.

### 2.5.1 Sentry — error tracking + source maps

- [ ] `pnpm add @sentry/react @sentry/vite-plugin`.
- [ ] Инициализация в `src/app/providers.tsx` (только production-сборка).
- [ ] Sentry-вариант `ErrorBoundary` оборачивает global boundary.
- [ ] Source maps загружаются в Sentry при build (Vite plugin), но не паблишатся в `dist/`.
- [ ] DSN в `.env.local` как `VITE_SENTRY_DSN`.
- [ ] PII scrubbing включён.

**Как лучше:** sample rate 0.1-0.2 в production — не платишь за весь трафик. Release tagging через `process.env.npm_package_version` + git SHA в meta. Подключи Sentry через `Sentry.ErrorBoundary` — оно само сообщает в Sentry о пойманных ошибках.

**📚 Refs:**

- Sentry React: https://docs.sentry.io/platforms/javascript/guides/react/
- Sentry Vite plugin (source maps): https://docs.sentry.io/platforms/javascript/sourcemaps/uploading/vite/
- Sentry releases: https://docs.sentry.io/product/releases/

### 2.5.2 Web Vitals + analytics

- [ ] `pnpm add web-vitals`.
- [ ] Web Vitals в Sentry — через `browserTracingIntegration` (Sentry Performance, `tracesSampleRate > 0`; отдельный API `Sentry.metrics` упразднён в 2024) — либо через `web-vitals` → события в PostHog/Plausible.
- [ ] Analytics: PostHog (self-hosted free tier) либо Plausible (privacy-first, без cookie-баннера).
- [ ] Event tracking минимальный: page view, search submitted, filter changed, favorite added.

**Как лучше:** не Google Analytics — для портфолио privacy-friendly стек (Plausible/PostHog/Umami) выглядит зрелее. Cookie banner с GA = legal-overhead, для каталога фильмов не нужно. INP (Interaction to Next Paint) — новая Core Web Vital вместо FID с 2024, обязательно её мониторь.

**📚 Refs:**

- web-vitals: https://github.com/GoogleChrome/web-vitals
- Plausible: https://plausible.io/docs
- PostHog: https://posthog.com/docs
- INP метрика: https://web.dev/articles/inp

### 2.5.3 Performance budgets + bundle visualization

- [ ] `pnpm add -D size-limit @size-limit/preset-app rollup-plugin-visualizer`.
- [ ] `pnpm add -D knip` — детектор unused exports/deps/files, job в CI.
- [ ] `size-limit` config в `package.json`: лимиты на entry bundle, vendor, per-route chunk.
- [ ] `size-limit` job в CI — fail при превышении.
- [ ] `rollup-plugin-visualizer` в `vite.config.ts` (mode `--analyze` → `dist/stats.html`).
- [ ] Route-based code splitting через `React.lazy` (если ещё не сделано).

**Как лучше:** не ставь лимит «с потолка» — измерь текущий размер, прибавь 10-20%, поставь как baseline. Каждый новый чанк/dep — explicit решение. `bundle-stats-action` в CI комментирует diff бандла в PR.

**📚 Refs:**

- size-limit: https://github.com/ai/size-limit
- rollup-plugin-visualizer: https://github.com/btd/rollup-plugin-visualizer
- React lazy + Suspense (code splitting): https://react.dev/reference/react/lazy
- bundlejs.com (онлайн bundle size check): https://bundlejs.com/

### 2.5.4 CSP headers + security

- [ ] CSP через HTTP-заголовок `Content-Security-Policy-Report-Only` (хостинг-конфиг — `vercel.json`/`netlify.toml`/`_headers`; **не** meta-тег — браузеры не поддерживают `report-uri`/`report-to`/`frame-ancestors` и сам режим report-only в `<meta>`).
- [ ] Endpoint для CSP-violations (можно в Sentry).
- [ ] После 1-2 недель без legitimate violations — переключение заголовка на enforce (`Content-Security-Policy`).
- [ ] Дополнительно: `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` (тот же хостинг-конфиг).
- [ ] SRI (Subresource Integrity) для external scripts (если есть).

**Как лучше:** включай CSP в production, не в dev — иначе мешает HMR. В фазе 4 (SSR) — заголовки выставляются сервером напрямую. Прогони итоговую конфигурацию через CSP Evaluator.

**📚 Refs:**

- MDN CSP: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- CSP Evaluator (Google): https://csp-evaluator.withgoogle.com/
- Vercel security headers: https://vercel.com/guides/how-to-add-security-headers-to-your-nextjs-app
- securityheaders.com — оценка прод-сайта: https://securityheaders.com/

### 2.5.5 E2E тесты (Playwright) с axe-core

- [ ] `pnpm add -D @playwright/test @axe-core/playwright`.
- [ ] `npx playwright install` — установка браузеров.
- [ ] `e2e/` папка с smoke-тестами:
  - [ ] Главная грузится, rails отрисованы.
  - [ ] Поиск работает (введи → результаты).
  - [ ] Фильтр работает (выбери жанр → URL обновился → результаты изменились).
  - [ ] Деталь открывается, табы переключаются.
  - [ ] Favorites: добавить → перезагрузить → присутствует.
  - [ ] Theme toggle меняет атрибут на `<html>`.
- [ ] A11y-проверка через `AxeBuilder` в каждом E2E-тесте (нет critical violations).
- [ ] Отдельный Playwright project с mobile viewport emulation (`devices['iPhone 13']`) — хотя бы smoke на `/`, `/search`, `/movie/:id`.
- [ ] E2E job в CI на каждый PR (параллельные шарды, `--workers=4`).

**Как лучше:** только critical user journeys в E2E. Не пытайся покрыть всё — это будет hell maintenance. Edge-cases — unit/integration тесты. Используй `data-testid` только когда нет семантического селектора — приоритет: role > label > text > testid.

**📚 Refs:**

- Playwright: https://playwright.dev/docs/intro
- Playwright a11y testing: https://playwright.dev/docs/accessibility-testing
- @axe-core/playwright: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
- Testing Library priority guide: https://testing-library.com/docs/queries/about/#priority

### 2.5.6 Lighthouse в CI

- [ ] `@lhci/cli` job в CI на preview-deploy URL.
- [ ] Бюджеты: Performance ≥ 90, A11y ≥ 95, SEO ≥ 95, Best Practices ≥ 90.
- [ ] Fail PR при просадке.
- [ ] Lighthouse-bot комментирует diff в PR (опционально).

**Как лучше:** запускай на preview URL, а не локально — реальное сетевое окружение, корректные метрики.

**📚 Refs:**

- Lighthouse CI: https://github.com/GoogleChrome/lighthouse-ci
- Lighthouse CI GitHub Action: https://github.com/treosh/lighthouse-ci-action
- web.dev Lighthouse guide: https://developer.chrome.com/docs/lighthouse/overview

### 2.5.7 Telemetry дашборд

- [ ] Sentry — alert на error rate > X%.
- [ ] Web Vitals в Sentry/PostHog — алёрт на P75 LCP > 2.5s.
- [ ] PostHog/Plausible — конверсия по ключевым flows.

**Как лучше:** алёрты должны быть actionable. Не «error rate > 0» — это шум. «P95 LCP > 4s в течение 10 мин» — это сигнал.

---

## Фаза 3. State management — параллельные ветки

Каждая ветка повторяет Phases 1+2, но через свой state-tool. Цель — сравнить DX, бойлерплейт, перформанс, размер бандла.

**Приоритизация:** семь веток — это месяцы работы. Для сравнительной таблицы (3.8) достаточно 3-4 идеологически разных подхода: `rtk` (уже начато), `tanstack-query` + Zustand (3.7 — production-default и база для Phase 4 SSR), `jotai` (atomic subscriptions). `mobx`/`reatom`/`effector`/соло-`zustand` — по желанию, как stretch goals.

### 3.1 `rtk` (уже начато)

- [ ] Favorites в `createSlice` с persist (`redux-persist` или listener middleware).
- [ ] Theme в `createSlice` с persist.
- [ ] `RTK Query` mutation для `toggleFavorite` (демо optimistic update).
- [ ] Server-side pagination в `getMovies` endpoint.
- [ ] Tag-based invalidation для recommendations.
- [ ] README ветки: разбор паттернов RTK.

**Как лучше:** не дроби slices попасно — один `uiSlice` для глобального UI-стейта + RTK Query для async.

**📚 Refs:**

- Redux Toolkit: https://redux-toolkit.js.org/
- RTK Query: https://redux-toolkit.js.org/rtk-query/overview
- redux-persist: https://github.com/rt2zz/redux-persist
- RTK Listener Middleware (альтернатива redux-persist): https://redux-toolkit.js.org/api/createListenerMiddleware

### 3.2 `zustand`

- [ ] `pnpm add zustand`.
- [ ] Несколько изолированных stores: `useFavoritesStore`, `useThemeStore`, `useFiltersStore`.
- [ ] `persist` middleware для favorites/theme.
- [ ] Селекторы с `shallow` для объектных слайсов.
- [ ] README ветки.

**Как лучше:** маленькие изолированные сторы = лучшая re-render-производительность. НЕ делай один gigant-store.

**📚 Refs:**

- Zustand: https://zustand.docs.pmnd.rs/
- Zustand persist middleware: https://zustand.docs.pmnd.rs/integrations/persisting-store-data
- Zustand + TypeScript: https://zustand.docs.pmnd.rs/guides/typescript

### 3.3 `reatom`

- [ ] `pnpm add @reatom/framework @reatom/npm-react`.
- [ ] Atoms на каждое поле, actions для мутаций.
- [ ] `reatomAsync` / `reatomResource` для async.
- [ ] Memoized derived atoms (явная демонстрация — `plans/main.md` 3.9).
- [ ] README ветки.

**Как лучше:** Reatom v3 — granular reactivity, не пытайся повторить redux-паттерны.

**📚 Refs:**

- Reatom: https://www.reatom.dev/
- Reatom для React: https://www.reatom.dev/package/npm-react/
- reatomAsync / reatomResource: https://www.reatom.dev/package/async/

### 3.4 `jotai`

- [ ] `pnpm add jotai`.
- [ ] Atomic state, `atomWithStorage` для favorites/theme.
- [ ] `atomFamily` для `movieByIdAtom(id)`.
- [ ] README ветки.

**Как лучше:** Jotai силён в granular subscriptions — грамотный split атомов критичен.

**📚 Refs:**

- Jotai: https://jotai.org/
- atomWithStorage: https://jotai.org/docs/utilities/storage
- atomFamily: https://jotai.org/docs/utilities/family

### 3.5 `effector`

- [ ] `pnpm add effector effector-react`.
- [ ] Stores + events + effects.
- [ ] `combine` для derived, `sample` для side-effects.
- [ ] README ветки.

**Как лучше:** event-driven, декларативные графы > императивные reducer'ы.

**📚 Refs:**

- Effector: https://effector.dev/
- Effector + React: https://effector.dev/en/api/effector-react/
- sample / combine: https://effector.dev/en/api/effector/sample/

### 3.6 `mobx`

- [ ] `pnpm add mobx mobx-react-lite`.
- [ ] Классы-сторы (`MoviesStore`, `FavoritesStore`).
- [ ] `observable`/`action`/`computed`.
- [ ] `observer(Component)` для подписки.
- [ ] README ветки.

**Как лучше:** ООП-подход в функциональном React-проекте может ощущаться чужеродно — это инсайт для сравнения.

**📚 Refs:**

- MobX: https://mobx.js.org/README.html
- mobx-react-lite: https://github.com/mobxjs/mobx/tree/main/packages/mobx-react-lite
- MobX best practices: https://mobx.js.org/defining-data-stores.html

### 3.7 `tanstack-query` + Zustand

- [ ] `pnpm add @tanstack/react-query`.
- [ ] Server-state — целиком в Query.
- [ ] UI-state — Zustand.
- [ ] `QueryClient` с дефолтами `staleTime: 5min`, `gcTime: 30min`.
- [ ] DevTools подключены.
- [ ] README ветки.

**Как лучше:** наиболее современный production-default. Чёткое разделение server vs client state.

**📚 Refs:**

- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Query keys best practices: https://tkdodo.eu/blog/effective-react-query-keys
- TkDodo blog (must-read для Query): https://tkdodo.eu/blog/practical-react-query
- DevTools: https://tanstack.com/query/latest/docs/framework/react/devtools

### 3.8 Сводная таблица в README на main

- [ ] Таблица: lib | bundle size | DX-баллы | best for.
- [ ] Bundle-size diff через `rollup-plugin-visualizer`, скриншот в README.

---

## Фаза 4. SSR/SSG — параллельные ветки

Брать `tanstack-query` (3.7) как базу — Query поддерживает hydration из коробки.

### 4.1 `ssr/nextjs`

- [ ] Миграция Vite → Next.js (актуальный major на момент реализации — на момент написания плана это Next.js 15, но проверь релиз-ноуты перед стартом).
- [ ] File-routing: `app/page.tsx`, `app/movie/[id]/page.tsx`, `app/search/page.tsx`.
- [ ] RSC по умолчанию, `'use client'` точечно.
- [ ] ISR на главной (`revalidate: 3600`).
- [ ] Динамический OG-image (`opengraph-image.tsx`).
- [ ] React Compiler в `next.config.ts`.
- [ ] README с метриками LCP/TTFB.

**Как лучше:** наш `src/app/` пересекается с Next-овым `app/` — переименуй FSD-слой в `_app/` или используй Next `app/` как entry.

**📚 Refs:**

- Next.js App Router: https://nextjs.org/docs/app
- Server Components: https://nextjs.org/docs/app/getting-started/server-and-client-components
- ISR: https://nextjs.org/docs/app/guides/incremental-static-regeneration
- Metadata API: https://nextjs.org/docs/app/api-reference/file-conventions/metadata
- React Compiler в Next: https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler

### 4.2 `ssr/tanstack-start`

- [ ] Миграция на TanStack Start.
- [ ] File-based routing (type-safe).
- [ ] Server functions через `createServerFn`.
- [ ] Hydration TanStack Query без warnings.
- [ ] README с метриками.

**Как лучше:** идеологически ближе к текущему стеку — портирование из `tanstack-query` минимально.

**📚 Refs:**

- TanStack Start: https://tanstack.com/start/latest
- TanStack Router (file-based routes): https://tanstack.com/router/latest/docs/framework/react/routing/file-based-routing
- Server Functions: https://tanstack.com/start/latest/docs/framework/react/server-functions

### 4.3 `ssr/vite-ssr`

- [ ] `entry-server.tsx` + `entry-client.tsx`.
- [ ] `server.js` (Hono/Express) для SSR-рендера.
- [ ] Hydration через `hydrateRoot`.
- [ ] Streaming через `renderToPipeableStream`.
- [ ] README с метриками + объяснение «магии под капотом».

**Как лучше:** образовательная ветка — покажет, как фреймворки делают SSR. В production не используется.

**📚 Refs:**

- Vite SSR guide: https://vite.dev/guide/ssr
- Vike (бывший vite-plugin-ssr): https://vike.dev/
- React renderToPipeableStream: https://react.dev/reference/react-dom/server/renderToPipeableStream
- hydrateRoot: https://react.dev/reference/react-dom/client/hydrateRoot

### 4.4 Общие требования ко всем SSR-веткам

- [ ] Нет hydration mismatch (контроль `Date.now()`, `window`, `Math.random()`).
- [ ] SEO meta (title/description/OG) per page.
- [ ] Lighthouse SEO = 100.
- [ ] view-source: содержит реальный HTML.

---

## Фаза 5. Backend / Auth — параллельные ветки

С появлением BFF появляется второй пакет — самое время для monorepo и Docker. Эти задачи делаются один раз в первой auth-ветке и переиспользуются в остальных.

### 5.0 Monorepo + Docker setup (делается в первой auth-ветке)

- [ ] Конвертация в pnpm workspaces: `pnpm-workspace.yaml` с `packages/*`.
- [ ] Структура: `packages/web/` (текущее приложение), `packages/server/` (BFF), `packages/shared/` (общие типы/схемы).
- [ ] Path aliases переиграны через workspace-packages (`@kinoshka/shared` в `package.json` dependencies).
- [ ] `pnpm add -D turbo` + `turbo.json` с pipeline (`build`, `dev`, `lint`, `test`).
- [ ] `Dockerfile` для server (multi-stage build, non-root user, healthcheck).
- [ ] `docker-compose.yml` для local dev (server + Postgres + Redis если нужно).
- [ ] `.dockerignore` (node_modules, dist, .env).
- [ ] Deploy target: Fly.io или Railway (бесплатный tier для портфолио).

**Как лучше:** Turborepo — overkill для 2 пакетов, но showcase. Для реального небольшого проекта `pnpm workspaces` без Turbo достаточно. Docker — multi-stage build обязателен (final image без dev deps), non-root для security.

**📚 Refs:**

- pnpm workspaces: https://pnpm.io/workspaces
- Turborepo: https://turborepo.com/docs
- Dockerfile best practices: https://docs.docker.com/build/building/best-practices/
- Docker для Node.js: https://nodejs.org/en/learn/getting-started/nodejs-docker-webapp
- Fly.io launch guide: https://fly.io/docs/launch/
- Railway: https://docs.railway.com/guides/foundations

### 5.1 `auth/hono-bff` + OAuth

- [ ] Hono-сервер с TypeScript.
- [ ] Проксирование `/api/movies/*` → Kinopoisk API с серверным `X-API-KEY`.
- [ ] OAuth (`GitHub` или `Yandex`) через `oslo`.
- [ ] httpOnly session cookies (sameSite=lax, secure).
- [ ] `/api/me/favorites` CRUD (SQLite через `better-sqlite3`).
- [ ] Logout invalidates session.
- [ ] CSRF protection.
- [ ] Rate limiting на auth endpoints.

**Как лучше:** edge-deployable (CF Workers, Vercel Edge). Хорошо комбинируется с SSR-веткой Next/TanStack Start.

**📚 Refs:**

- Hono: https://hono.dev/
- Hono cookies: https://hono.dev/docs/helpers/cookie
- oslo (auth primitives, от автора Lucia): https://oslojs.dev/
- Lucia auth resources (архивно, но guide отличный): https://lucia-auth.com/
- better-sqlite3: https://github.com/WiseLibs/better-sqlite3

### 5.2 `auth/fastify-sessions` + email/password

- [ ] Fastify-сервер (faster + schema-validation).
- [ ] Drizzle ORM + SQLite (потом миграция на Postgres).
- [ ] `/api/auth/register` — argon2 hash.
- [ ] `/api/auth/login` — verify + httpOnly session cookie.
- [ ] `/api/auth/logout` — invalidate.
- [ ] `/api/me/favorites` protected route.
- [ ] CSRF + rate limiting.

**Как лучше:** session cookies (httpOnly), НЕ JWT в localStorage (XSS-уязвимо). `argon2` современнее `bcrypt`.

**📚 Refs:**

- Fastify: https://fastify.dev/docs/latest/
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- @node-rs/argon2 (быстрая Rust-имплементация): https://github.com/napi-rs/node-rs/tree/main/packages/argon2
- Why session cookies > JWT in browser: https://thecopenhagenbook.com/sessions
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

### 5.3 `auth/nextjs-webauthn` (passkeys)

- [ ] Next.js API routes.
- [ ] `@simplewebauthn/server` + `@simplewebauthn/browser`.
- [ ] Postgres + Drizzle для credentials store.
- [ ] Register passkey → login через biometric (Touch ID / Face ID).
- [ ] Fallback на email-magic-link.
- [ ] CSRF + rate limiting.

**Как лучше:** «вау» в портфолио — WebAuthn = production-grade современный auth.

**📚 Refs:**

- SimpleWebAuthn: https://simplewebauthn.dev/docs/
- Passkeys на passkeys.dev: https://passkeys.dev/
- WebAuthn explainer: https://webauthn.guide/
- Webauthn.io (тестовый стенд): https://webauthn.io/

### 5.4 Общие требования ко всем auth-веткам

- [ ] API-key НЕ виден в client bundle (`grep` по `dist/`).
- [ ] httpOnly + Secure + SameSite=Lax на cookies.
- [ ] Cross-tab session sync.
- [ ] Logout очищает cookie и server session.
- [ ] Favorites guest → user merge при логине.
- [ ] Favorites-мутация переведена на `useOptimistic` (перенесено из Phase 2 — на localStorage оптимистичный UI был избыточен, здесь запрос реально асинхронный).
- [ ] README с архитектурной диаграммой.

---

## Фаза 6. Scaling & product polish

Делается, когда базовый продукт стабилен. В реальной команде эти вещи появляются «по требованию» — когда команда растёт, когда выходишь на новый рынок, когда есть offline-use case. Для портфолио — отличные дифференциаторы.

### 6.1 Storybook + design system docs

- [ ] `pnpm dlx storybook@latest init`.
- [ ] Stories для `shared/ui` компонентов (Spinner, Skeleton, Card, AsyncBoundary).
- [ ] Stories для widgets (Header, Footer, BottomNav).
- [ ] MDX-страница с design tokens (показывает все CSS-переменные с превью).
- [ ] Controls + actions + a11y addon (`@storybook/addon-a11y`).
- [ ] Storybook deploys в Vercel/Chromatic-static как отдельный URL, ссылка в README.

**Как лучше:** Storybook 8+ — Vite-based, быстрый. Не пытайся покрыть всё — focus на shared/ui + критичные widgets. Per-component stories — `Default`, `Loading`, `Error`, `Empty`. CSF 3 format — короче, чище. Args + ArgTypes — авто-генерят controls.

**📚 Refs:**

- Storybook: https://storybook.js.org/docs
- CSF 3: https://storybook.js.org/docs/api/csf
- @storybook/addon-a11y: https://storybook.js.org/addons/@storybook/addon-a11y
- Storybook + Vite: https://storybook.js.org/docs/builders/vite

### 6.2 ADRs (Architecture Decision Records)

- [ ] `docs/adr/` папка, шаблон Michael Nygard (`README.md` с шаблоном).
- [ ] `0001-feature-sliced-design.md` — почему FSD, какие альтернативы рассмотрены.
- [ ] `0002-state-management-comparison.md` — выбор стратегии сравнения state-libs.
- [ ] `0003-api-client-generation.md` — почему apicraft, какие проблемы решает.
- [ ] `0004-auth-strategy.md` — обзор подходов из Phase 5 (BFF/sessions/passkeys), trade-offs.
- [ ] `0005-ssr-framework-choice.md` — критерии выбора Next/TanStack Start/Vite SSR.
- [ ] Mermaid-диаграммы архитектуры в README (data flow, layered architecture).
- [ ] Опционально: log4brains для красивого Web-UI над ADRs.

**Как лучше:** ADR — это не «как мы сделали», а «почему мы так решили». Format: Context → Decision → Consequences. Каждый ADR — 1-2 страницы, не больше. Status: Proposed → Accepted → Superseded. Никогда не редактируй принятый ADR — пиши новый со ссылкой «supersedes 0003».

**📚 Refs:**

- ADR templates (Joel Parker Henderson): https://github.com/joelparkerhenderson/architecture-decision-record
- Michael Nygard оригинальный пост: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions
- log4brains (Web UI для ADRs): https://github.com/thomvaill/log4brains
- Mermaid в GitHub Markdown: https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams

### 6.3 i18n (ru/en switching)

- [ ] `pnpm add i18next react-i18next i18next-browser-languagedetector`.
- [ ] `public/locales/{ru,en}/common.json` (и др. namespaces).
- [ ] Все хардкодные русские строки вынесены в `t('...')` (используй codemod типа `i18next-scanner` для extraction).
- [ ] LanguageSwitcher в Header.
- [ ] `Intl.DateTimeFormat` для дат, `Intl.NumberFormat` для рейтингов/runtime, `Intl.PluralRules` для «3 сезона/5 сезонов».
- [ ] `Intl.Collator` для locale-aware сортировки.
- [ ] SEO: `<html lang="...">` обновляется, hreflang теги на SSR-страницах (Phase 4).
- [ ] Persist выбранного языка в localStorage + cookie (для SSR).

**Как лучше:** i18next + react-i18next — стандарт. Не путай i18n (внешний слой) с локалью данных (приходит из API). Postpone API-locale до того, как поймёшь, поддерживает ли Kinopoisk API мульти-локали. Lazy-load локалей через `i18next-http-backend` — не грузишь сразу все языки. Lokalise/Crowdin/Tolgee — translation management (для команды), для соло-проекта избыточно.

**📚 Refs:**

- react-i18next: https://react.i18next.com/
- i18next: https://www.i18next.com/
- i18next-scanner (extraction): https://github.com/i18next/i18next-scanner
- MDN Intl: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl
- formatjs (альтернатива i18next): https://formatjs.io/

### 6.4 PWA + offline

- [ ] `pnpm add -D vite-plugin-pwa workbox-window`.
- [ ] `manifest.webmanifest` (name, icons, theme_color, display: standalone).
- [ ] Service worker через Workbox: cache-first для постеров, stale-while-revalidate для API.
- [ ] Offline-banner: «Вы offline, показаны кэшированные данные».
- [ ] Favorites работают offline (уже работают через localStorage из 2.1).
- [ ] Install prompt компонент (отслеживай `beforeinstallprompt` event).
- [ ] Manifest валиден без ошибок (DevTools → Application → Manifest), приложение устанавливается (`beforeinstallprompt` срабатывает), offline-smoke зелёный (`context.setOffline(true)` в Playwright). _(Категория "PWA" удалена из Lighthouse начиная с v12 — не использовать как числовой критерий.)_

**Как лучше:** Workbox через `vite-plugin-pwa` проще, чем писать SW руками. Не кэшируй `index.html` long-term (иначе stuck users). Workbox revision-aware для статики. `registerType: 'autoUpdate'` — UI обновится при появлении новой версии SW (с консент-промптом или без).

**📚 Refs:**

- vite-plugin-pwa: https://vite-pwa-org.netlify.app/
- Workbox: https://developer.chrome.com/docs/workbox
- Web App Manifest: https://developer.mozilla.org/en-US/docs/Web/Manifest
- web.dev PWA guide: https://web.dev/explore/progressive-web-apps
- PWABuilder (генератор assets): https://www.pwabuilder.com/

### 6.5 Visual regression

- [ ] Вариант А: Playwright screenshots (`expect(page).toHaveScreenshot()`) + baseline в репо.
- [ ] Вариант Б: Chromatic (если уже есть Storybook — интеграция в 1 строку, free для open-source).
- [ ] Snapshots для критичных pages (главная, /search, /movie/:id) на desktop + mobile.
- [ ] Auto-approve trivial diffs (>X% pixel diff = manual review).
- [ ] CI job — fail PR при визуальной регрессии.

**Как лучше:** Chromatic > self-hosted Playwright snapshots если есть Storybook (UI для approve diffs, история). Если без Storybook — Playwright. Не делай visual regression до того, как дизайн стабилизировался — будешь approve diffs каждый PR. Снапшоты разных тем (light/dark) — отдельно.

**📚 Refs:**

- Chromatic: https://www.chromatic.com/docs/
- Playwright screenshots: https://playwright.dev/docs/screenshots
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Percy (альтернатива Chromatic): https://percy.io/

---

## Verification (детальные критерии)

### Phase 0

- [ ] `make build` зелёный.
- [ ] `make test` запускается и проходит хотя бы один тест.
- [ ] DevTools → Network: API возвращает 200 на `/`.
- [ ] ErrorBoundary ловит `throw new Error()` в компоненте → показывает fallback.
- [ ] CI на PR проходит lint+typecheck+test+build за < 5 мин.
- [ ] Preview-deploy URL появляется в комментарии PR.
- [ ] Попытка коммита с `console.log` или ESLint error блокируется pre-commit hook.
- [ ] Попытка коммита `git commit -m "fix stuff"` блокируется commitlint (нужен conventional format).
- [ ] `eslint-plugin-jsx-a11y` ловит компонент без alt/aria-label.
- [ ] `gitleaks` ловит попытку коммита `.env.local`.
- [ ] `Dependabot/Renovate` PR появляются автоматически.

### Phase 1

- [ ] На `/` — реальные фильмы (не из `CATALOG`).
- [ ] `/search?q=Inception` — реальный поиск.
- [ ] `/search?genres=драма&year=2020` после reload — состояние сохранено.
- [ ] Пагинация ходит на сервер (в пределах страниц 1–10 demo-тарифа).
- [ ] `/movie/666` → ErrorState с retry.

### Phase 2

- [ ] Сердечко → reload → сохранено.
- [ ] Очистка localStorage → реакция в UI.
- [x] Theme reload-persist + cross-tab sync.
- [ ] `/popular` отображает данные из endpoint.
- [ ] 3-5 favorites → `/recommendations` показывает релевантные.
- [ ] <720px → mobile-варианты страниц.
- [ ] Lighthouse Performance ≥ 90 для главной.

### Phase 2.5

- [ ] Кинь `throw new Error('test')` в production-сборке → ошибка появляется в Sentry с source-map.
- [ ] Web Vitals видны в Sentry/PostHog dashboard (открой страницу — событие пришло).
- [ ] `pnpm size-limit` — все бюджеты в пределах нормы.
- [ ] CSP включён, в DevTools нет CSP violations на main flow.
- [ ] `npx playwright test` — все E2E проходят локально.
- [ ] Lighthouse CI в PR показывает Performance ≥ 90, A11y ≥ 95.
- [ ] `@axe-core/playwright` не находит critical violations.
- [ ] Намеренное превышение size-limit (добавь жирную dep) — CI падает.

### Phase 3 (per ветка)

- [ ] Все фичи Phase 1+2 работают.
- [ ] DevTools видит state-tool артефакты.
- [ ] README с разбором паттернов + плюсы/минусы.
- [ ] Bundle-size diff в README.

### Phase 4 (per SSR-ветка)

- [ ] `view-source:` страницы — реальный HTML.
- [ ] Lighthouse SEO = 100.
- [ ] Нет hydration warnings.
- [ ] OG-preview работает (opengraph.xyz).

### Phase 5 (per auth-ветка)

- [ ] API-key не в bundle.
- [ ] Cookie: `HttpOnly; Secure; SameSite=Lax`.
- [ ] Login в одной вкладке → реакция в другой.
- [ ] Logout очищает state, защищённые endpoints возвращают 401.
- [ ] (5.3) WebAuthn работает на Touch ID / Face ID.
- [ ] `pnpm -w build` собирает все workspace-packages.
- [ ] `docker compose up` поднимает server + (Postgres/Redis) локально.
- [ ] Deploy в Fly.io/Railway успешен, healthcheck зелёный.
- [ ] Final Docker image НЕ содержит dev deps (`docker image inspect ...`).

### Phase 6

- [ ] Storybook deploy-URL доступен, ссылка в README.
- [ ] `@storybook/addon-a11y` не показывает violations на ключевых stories.
- [ ] Минимум 5 ADRs в `docs/adr/`, каждый по шаблону.
- [ ] Mermaid-диаграмма архитектуры рендерится в GitHub README.
- [ ] LanguageSwitcher переключает ru → en, все строки локализованы.
- [ ] `Intl.NumberFormat` показывает рейтинг как `8,4` в ru и `8.4` в en.
- [ ] Offline-режим: выключи сеть → favorites доступны, на остальных страницах банер.
- [ ] Manifest без ошибок в DevTools, offline-режим проходит smoke-тест.
- [ ] Намеренное визуальное изменение (цвет кнопки) → visual regression PR падает.

---

## Файлы для базовой реализации (Phase 0+1+2 на main)

- `src/shared/api/client.ts` — singleton instance с auth.
- `src/shared/ui/{AsyncBoundary,Skeleton,EmptyState,ErrorState,Spinner,ErrorBoundary}/`.
- `src/shared/lib/storage.ts`.
- `src/shared/config/features.ts`.
- `src/entities/movie/api/` — обёртки над generated client.
- `src/features/{favorites,theme,weekly-popular,recommendations}/`.
- `src/features/catalog-filter/` — допилить URL-sync + реальное API.
- `src/pages/{home,search,movie}/ui/*Desktop/` — заменить mock на API.
- `src/pages/{home,search,movie}/ui/*Mobile/` — полноценные реализации.
- `src/pages/favorites/` — новая страница.
- `vite.config.ts` — test config + `rollup-plugin-visualizer`.
- `Makefile` — `test`, `e2e`, `analyze` targets.
- `package.json` — новые dev-deps + `lint-staged` config + `size-limit` config.

### Дополнительно (Phase 0 production-engineering)

- `.github/workflows/{ci,lighthouse,codeql}.yml`
- `.github/dependabot.yml` (или `renovate.json`)
- `.github/pull_request_template.md`
- `.husky/{pre-commit,commit-msg}`
- `commitlint.config.js`
- `eslint.config.js` — добавить `jsx-a11y`.
- `vercel.json` / `netlify.toml` / `_headers` — security headers.

### Phase 2.5 (pre-launch)

- `src/app/sentry.ts` — Sentry init.
- `src/shared/lib/analytics.ts` — web-vitals reporter + analytics wrapper.
- `e2e/{home,search,movie,favorites}.spec.ts` — Playwright тесты.
- `playwright.config.ts`.
- `lighthouserc.js` — Lighthouse CI config.
- `index.html` — CSP meta-тег.

### Phase 5 (monorepo + Docker)

- `pnpm-workspace.yaml`
- `turbo.json`
- `packages/{web,server,shared}/`
- `packages/server/Dockerfile`
- `docker-compose.yml`
- `.dockerignore`

### Phase 6 (scaling)

- `.storybook/{main.ts,preview.ts}`
- `*.stories.tsx` — рядом с компонентами.
- `docs/adr/{template.md,0001-...md,0002-...md,...}`
- `public/locales/{ru,en}/*.json`
- `src/shared/i18n/index.ts` — i18next init.
- `public/manifest.webmanifest`
- `chromatic.config.json` (если Chromatic).

Ветки наследуют этот же набор + tool-specific файлы.

---

## Дополнительные ресурсы (общее)

**Архитектура и FSD:**

- Feature-Sliced Design (официально): https://feature-sliced.design/
- FSD 2.x examples: https://github.com/feature-sliced/examples
- Bulletproof React (другой взгляд на структуру): https://github.com/alan2207/bulletproof-react

**React 19 и Compiler:**

- React 19 release notes: https://react.dev/blog/2024/12/05/react-19
- React Compiler: https://react.dev/learn/react-compiler
- React Compiler playground: https://playground.react.dev/

**TypeScript:**

- Total TypeScript (Matt Pocock): https://www.totaltypescript.com/
- Type Challenges: https://github.com/type-challenges/type-challenges
- TS handbook: https://www.typescriptlang.org/docs/handbook/intro.html

**Performance:**

- web.dev performance: https://web.dev/explore/performance
- Core Web Vitals: https://web.dev/articles/vitals
- Patterns.dev (perf patterns): https://www.patterns.dev/

**Security:**

- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP Cheat Sheets: https://cheatsheetseries.owasp.org/
- web.dev secure: https://web.dev/explore/secure

**A11y:**

- web.dev accessible: https://web.dev/explore/accessible
- Inclusive Components (Heydon Pickering): https://inclusive-components.design/
- WAI-ARIA APG: https://www.w3.org/WAI/ARIA/apg/

**Блоги, которые стоит читать регулярно:**

- TkDodo (React Query / React patterns): https://tkdodo.eu/blog/
- Josh W. Comeau (React / CSS / DX): https://www.joshwcomeau.com/
- Kent C. Dodds (testing / React): https://kentcdodds.com/blog
- Mark Erikson (Redux maintainer): https://blog.isquaredsoftware.com/
- Lee Robinson (Vercel/Next): https://leerob.com/
- Theo Browne (стек, экосистема): https://t3.gg/

**Карьерный рост Senior:**

- Staff Engineer Path: https://staffeng.com/
- Will Larson's "Staff Engineer": https://lethain.com/
- The Pragmatic Engineer (Gergely Orosz): https://newsletter.pragmaticengineer.com/
