# Sentry: error tracking + source maps (роадмап 2.5.1)

## Overview

Реализовать пункт `2.5.1` из `plans/roadmap.md` — подключить Sentry для error tracking в
production-сборке SPA:

- инициализация `@sentry/react` только в prod-сборке;
- глобальный error boundary на базе `Sentry.ErrorBoundary`, оборачивающий всё приложение;
- аплоад source maps в Sentry на этапе билда через `@sentry/vite-plugin`, без публикации `.map`
  в `dist/`;
- release tagging (`package.json` version + git SHA);
- PII scrubbing (defense-in-depth: `X-API-KEY`, который `@shared/api/client.ts` кладёт в
  заголовок каждого запроса, не должен попасть в Sentry, если когда-нибудь окажется в
  request-контексте события).

`@sentry/react` и `@sentry/vite-plugin` уже добавлены в зависимости (`package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml` — `allowBuilds: '@sentry/cli'`), но не подключены нигде
в коде — это чистая задача на интеграцию, без выбора между архитектурными вариантами.

**Скоуп: только error tracking, без performance tracing.** Roadmap разносит это по двум
пунктам — `2.5.1` (error tracking) и `2.5.2` (Web Vitals/analytics). `browserTracingIntegration`
из коробки именует транзакции по сырому URL, а в приложении есть параметризованный роут
`/movie/:id` (`src/app/router.tsx`) — без `wrapCreateBrowserRouter` +
`reactRouterBrowserTracingIntegration` каждый фильм превращается в свою транзакцию (бесполезные
данные). Эта работа — предмет `2.5.2`, не этого плана; здесь `tracesSampleRate`/трейсинг не
подключаются вообще.

**Секреты — плейсхолдеры.** DSN, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` в этом плане
заводятся как плейсхолдеры в `.env.local`/`.env.example` — проект в Sentry ещё не создан.
Реальные значения и подключение к CI — Post-Completion, вне скоупа этого плана.

## Context (from discovery)

- `src/app/providers.tsx` — сейчас всего один компонент, рендерит `<RouterProvider>`. Ни одного
  глобального error boundary в дереве нет вообще — есть только точечные `AsyncBoundary`
  (`src/shared/ui/AsyncBoundary`) вокруг конкретных async-секций (rails, `/search`,
  `/movie/:id`), каждый со своим `ErrorBoundary` (`src/shared/ui/ErrorBoundary`) и `ErrorState`
  (`src/shared/ui/ErrorState`) фолбэком.
- `src/App.tsx` — неиспользуемый leftover от Vite-темплейта (не импортируется нигде,
  реальное дерево — `src/main.tsx` → `Providers` → `router.tsx` → `AppLayout` → страницы).
  Вне скоупа этого плана.
- `vite.config.ts` — простой `defineConfig({...})` (не функция), без `mode`/`command`/`loadEnv`,
  без `define`, без `build.sourcemap`.
- `.env.local`/`.env.example` — уже есть `VITE_API_KEY`, `APP_API_URL`, `VITE_BASE_URL`.
  `.env.local` в `.gitignore`, `.env.example` — нет (коммитится с плейсхолдерами).
- Нет `src/vite-env.d.ts` — типы `import.meta.env` идут только из `vite/client` (в
  `tsconfig.app.json`), кастомных ambient-деклараций в проекте пока нет.
- **Родовая проблема репозитория, важная для этого плана**: `make typecheck` = `pnpm exec tsc
  --noEmit` против корневого `tsconfig.json` (`{ "files": [], "references": [...] }`) —
  проверено: `pnpm exec tsc --noEmit --listFiles` возвращает **0 файлов**. Solution-style
  конфиг без `-b` не типизирует ничего, в т.ч. не видит ни `vite.config.ts`
  (`tsconfig.node.json`), ни `src/**`. CI (`.github/workflows/ci.yml`) держит на этом отдельную
  job `typecheck`, а job `build` гоняет `make build-only` (`pnpm exec vite build`, без `tsc`
  вообще) — то есть ни одна job в CI реально не типчекает `vite.config.ts`, который эта задача
  меняет. Это не в скоупе фикса этим планом (отдельная проблема репо), но задачи ниже
  используют `pnpm exec tsc -b` (то, что реально стоит первым шагом в `make build`) как
  единственный надёжный gate, а не `make typecheck`.
- Читать версию пакета в `vite.config.ts` лучше не через `process.env.npm_package_version` —
  эта переменная гарантированно доступна только когда сборка запущена именно как npm/pnpm
  *script* (`pnpm build`/`make build` — да; `make build-only` → `pnpm exec vite build` — не
  гарантированно; CI's `build` job именно `make build-only`). Вместо этого — прямое чтение
  `package.json` через `fs.readFileSync` в Node-контексте конфига: работает одинаково в любом
  пути запуска, без специального документирования ограничений.
- Тесты: Vitest + MSW (`src/test/setup.ts`), `globals: true`. Компонентные тесты — через
  `@testing-library/react`, паттерн виден в `src/app/layouts/AppLayout.test.tsx`. Стиль
  компонентов проекта — `export const Foo = (props: FooProps) => ...`, именованные типы
  пропсов, `PropsWithChildren` где уместно (не `function`-декларации, не `React.FC`).

## Development Approach

- **Тестовый подход**: Regular — код, потом тесты для новой логики в каждой задаче.
- Каждая задача — атомарный, законченный кусок; тесты пишутся сразу после кода в той же задаче.
- Все тесты должны проходить перед переходом к следующей задаче.
- Обновлять чекбоксы этого файла по ходу выполнения.

## Solution Overview

- **Release строится один раз, в Node-контексте `vite.config.ts`, и инлайнится одной константой
  `__APP_RELEASE__`.** Версия — прямым чтением `package.json` (`fs.readFileSync` +
  `JSON.parse`, без `process.env.npm_package_version` — см. Context), git SHA — через
  `execSync('git rev-parse --short HEAD')` с fallback `'unknown'` в try/catch (билд не должен
  падать, если `.git` недоступен, напр. в некоторых Docker-образах). Ровно эта же строка
  передаётся и в `Sentry.init({ release })` (через define), и в `sentryVitePlugin({ release:
  { name } })` — иначе SDK и аплоад sourcemaps тегируют разные releases в Sentry (плагин по
  умолчанию берёт полный git SHA, если `release.name` не задан явно) и метаданные события не
  находят свой sourcemap. Строить release-строку через отдельный тестируемый модуль,
  импортируемый и в Node (`vite.config.ts`), и в браузерный код — лишняя связанность
  (`src/app/sentry.ts` тянет `@sentry/react`, не тот код, который хочется грузить при чтении
  конфига); строка — тривиальный темплейт-литерал прямо в `vite.config.ts`, без отдельного
  юнит-теста (покрывается сборочной проверкой в Task 6).
- **Sentry-vite-plugin подключается только при `command === 'build'` и наличии всех трёх
  кредов**, и всегда — **последним** в массиве `plugins` (требование самого плагина — должен
  видеть финальный вывод rollup/vite). Без гварда на `command` плагин цеплялся бы и на `vite
  dev`/Vitest, как только в `.env.local` появятся настоящие креды (Post-Completion). Плагину
  задаётся `errorHandler`, который не роняет билд, если аплоад упал (невалидный токен, сетевая
  ошибка) — так неудачный аплоад sourcemaps не блокирует деплой.
- **`build.sourcemap` завязан на то же условие, что и сам плагин, а не на `true`
  безусловно.** Rollup/Vite сами решают, писать ли `.map`-файлы — это независимо от того,
  добавлен ли `sentryVitePlugin` в `plugins`. `sourcemap: true` при отсутствующих кредах (а
  плейсхолдеры — это ровно тот случай, в котором план стартует) писал бы `.map` в `dist/` и
  добавлял `//# sourceMappingURL=...` в каждый чанк, из `dist/` их бы никто не удалял (у
  `filesToDeleteAfterUpload` в этом сценарии нет исполнителя) — то есть требование роадмапа "не
  паблишатся в dist" ломалось бы прямо на дефолтных плейсхолдерах. С кредами `sourcemap: true` +
  удаление после аплоада тоже не то: `//# sourceMappingURL=` комментарий остаётся в чанках
  (файл, на который он ссылается, уже удалён) — 404 в devtools у любого посетителя. Решение:
  `sourcemap: sentryEnabled ? 'hidden' : false` — `'hidden'` пишет `.map`, но без комментария в
  чанке, и именно `filesToDeleteAfterUpload` на плагине зачищает файлы из `dist/` уже после
  аплоада.
- **Инициализация — явная функция `initSentry()`, а не side-effect при импорте.** Тестируемо
  (можно замокать `@sentry/react` и дёрнуть функцию с разными `import.meta.env.PROD` через
  `vi.stubEnv`), в отличие от кода на верхнем уровне модуля, который выполняется один раз при
  импорте и не поддаётся многократному тестированию с разными условиями. Функция также рано
  выходит, если `VITE_SENTRY_DSN` пуст (ровно так план и стартует — плейсхолдер), чтобы
  `Sentry.init('')` не устанавливал глобальные обработчики и не инструментировал `fetch` без
  всякой пользы.
- **Глобальный boundary — отдельный компонент `GlobalErrorBoundary`, а не правка
  `shared/ui/ErrorBoundary`.** `shared/ui/ErrorBoundary` — общий примитив, на котором уже
  держится `AsyncBoundary` во всех точечных async-секциях (rails, `/search`, `/movie/:id`);
  трогать его ради Sentry — не по скоупу этой задачи и расширяет blast radius правки без нужды.
  Роадмап требует именно "`Sentry`-вариант `ErrorBoundary` оборачивает global boundary" — это
  ровно один новый компонент на верхнем уровне (`src/app/GlobalErrorBoundary.tsx`, плоским
  файлом рядом с `providers.tsx`/`router.tsx` — в `app/`-слое так уже устроено, отдельная
  директория-на-компонент из "Component structure" — конвенция для `widgets/`/`features/`,
  здесь сознательно не используется), использующий `Sentry.ErrorBoundary` и существующий
  `ErrorState` как UI фолбэка, симметрично тому, как `AsyncBoundary` использует `ErrorState` для
  точечных секций.
- **PII scrubbing — `beforeSend` вырезает `X-API-KEY`/`x-api-key` из `event.request.headers`,
  если он там окажется.** При `sendDefaultPii: false` (дефолт SDK, план явно фиксирует) браузерный
  SDK не прикладывает заголовки запроса к событию сам по себе — так что это defense-in-depth на
  случай будущей интеграции/ручного контекста, а не закрытие уже существующей дыры. Отдельно
  зафиксировать в документации (Task 5) реальный, уже существующий и не устраняемый этим планом
  факт: `VITE_API_KEY` инлайнится в клиентский бандл (см. `src/shared/api/client.ts`) и, значит,
  осядет и в загруженных в Sentry source maps как часть исходников — принятое ограничение до
  Фазы 5 (BFF), не регрессия от этого плана.

## Technical Details

### Новые/изменённые файлы

```
vite.config.ts                          — command/mode/loadEnv, версия из package.json, __APP_RELEASE__ define, sourcemap, sentry plugin
src/vite-env.d.ts                       — CREATE: ambient declare const __APP_RELEASE__: string
src/app/sentry.ts                       — CREATE: initSentry(), scrubApiKeyHeader()
src/app/sentry.test.ts                  — CREATE
src/app/GlobalErrorBoundary.tsx         — CREATE
src/app/GlobalErrorBoundary.test.tsx    — CREATE
src/app/providers.tsx                   — подключить initSentry()+GlobalErrorBoundary
src/app/providers.test.tsx              — CREATE
.env.local                              — + VITE_SENTRY_DSN, SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT (плейсхолдеры)
.env.example                            — то же, плейсхолдеры
AGENTS.md                               — новый раздел "Error tracking (Sentry)"
plans/roadmap.md                        — отметить чекбоксы 2.5.1
```

## What Goes Where

- **Implementation Steps** — все задачи ниже, включая тесты и обновление документации.
- **Post-Completion** — создание реального проекта в Sentry, реальные DSN/токен, подключение
  секретов в CI, живая проверка доставки ошибки и sourcemap в дашборде Sentry.

## Implementation Steps

### Task 1: Vite build config — release define, sourcemap, sentry-vite-plugin

**Files:**

- Modify: `vite.config.ts`
- Create: `src/vite-env.d.ts`

- [x] Переписать `defineConfig({...})` в `defineConfig(({ mode, command }) => {...})`, внутри
      вызвать `loadEnv(mode, process.cwd(), '')` (пустой префикс — иначе `SENTRY_*` без
      `VITE_`-префикса не попадут в результат) и получить `env`.
- [x] Прочитать версию пакета через `JSON.parse(readFileSync(new URL('./package.json',
      import.meta.url), 'utf-8')).version` (`node:fs`) — не через
      `process.env.npm_package_version` (см. Context/Solution Overview).
- [x] Добавить чтение git SHA через `execSync('git rev-parse --short HEAD', { encoding: 'utf-8'
      }).trim()`, обёрнутое в `try/catch` с fallback `'unknown'`.
- [x] Собрать `const release = \`kinoshka@${version}+${gitSha}\`` — одна строка на весь конфиг.
- [x] Вычислить `const sentryEnabled = command === 'build' && Boolean(env.SENTRY_AUTH_TOKEN &&
      env.SENTRY_ORG && env.SENTRY_PROJECT)`.
- [x] Собрать массив `plugins` императивно: `[react(), babel({...})]`, и только если
      `sentryEnabled` — запушить в конец `sentryVitePlugin({ org: env.SENTRY_ORG, project:
      env.SENTRY_PROJECT, authToken: env.SENTRY_AUTH_TOKEN, release: { name: release },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] }, errorHandler: (error) => {
      console.warn('[sentry-vite-plugin]', error) } })` (импорт `sentryVitePlugin` из
      `@sentry/vite-plugin`) — `errorHandler` не даёт неудачному аплоаду (невалидный токен,
      сеть) уронить сборку.
- [x] Добавить `define: { __APP_RELEASE__: JSON.stringify(release) }` — задаётся безусловно
      (не только когда `sentryEnabled`), т.к. `sentry.ts` читает эту константу при каждой
      сборке, а use-site сам решает, нужна ли она (см. Task 2).
- [x] Добавить `build: { sourcemap: sentryEnabled ? 'hidden' : false }`.
- [x] Создать `src/vite-env.d.ts` с `declare const __APP_RELEASE__: string` — без единого
      top-level `import`/`export` в файле (иначе он станет модулем, и `declare const`
      перестанет быть глобальной декларацией).
- [x] Убедиться, что `resolve`/`test`-секции конфига не сломались после перехода на функцию
      `defineConfig` (возврат объекта из колбэка), и что `define` из этого же объекта долетает
      и до Vitest-запуска (он использует тот же `defineConfig`, просто с `mode: 'test'` —
      `define` в возвращаемом объекте ни от чего не зависит и применяется всегда).
- [x] Прогнать `pnpm exec tsc -b` (не `make typecheck` — см. Context, корневой `tsconfig.json`
      без `-b` не проверяет ни `vite.config.ts`, ни `src/**`) и `make test` — существующие
      тесты не должны сломаться от смены формы `defineConfig`.

### Task 2: `src/app/sentry.ts` — initSentry, PII scrubbing

**Files:**

- Create: `src/app/sentry.ts`
- Create: `src/app/sentry.test.ts`

- [x] `export const scrubApiKeyHeader = (event: Sentry.ErrorEvent): Sentry.ErrorEvent => {...}`
      — если `event.request?.headers` существует, удаляет ключи `X-API-KEY`/`x-api-key`;
      возвращает `event` без мутации остальных полей.
- [x] `export const initSentry = (): void => {...}` — читает `const dsn =
      import.meta.env.VITE_SENTRY_DSN`; при `!import.meta.env.PROD || !dsn` — сразу `return`.
      Иначе вызывает `Sentry.init({ dsn, release: __APP_RELEASE__, environment:
      import.meta.env.MODE, sendDefaultPii: false, beforeSend: scrubApiKeyHeader })`. Без
      `integrations`/`tracesSampleRate` — трейсинг вне скоупа (см. Overview).
- [x] Написать тесты на `scrubApiKeyHeader`: событие с `request.headers['X-API-KEY']` →
      заголовок вырезан, остальные заголовки не тронуты; событие без `request` → возвращается
      как есть, без исключения.
- [x] Написать тесты на `initSentry` с `vi.mock('@sentry/react')`:
      - `vi.stubEnv('PROD', false)` (или `VITE_SENTRY_DSN` пуст при `PROD=true`) → `Sentry.init`
        не вызван;
      - `vi.stubEnv('PROD', true)` + непустой `VITE_SENTRY_DSN` → `Sentry.init` вызван ровно
        один раз с объектом, содержащим `dsn`, `release: __APP_RELEASE__`, `sendDefaultPii:
        false`, `beforeSend: scrubApiKeyHeader`, и **без** `tracesSampleRate`/`integrations`.
- [x] `make test` — проходит.

### Task 3: `GlobalErrorBoundary` — Sentry.ErrorBoundary поверх всего приложения

**Files:**

- Create: `src/app/GlobalErrorBoundary.tsx`
- Create: `src/app/GlobalErrorBoundary.test.tsx`
- Modify: `src/app/providers.tsx`
- Create: `src/app/providers.test.tsx`

- [ ] `export const GlobalErrorBoundary = ({ children }: PropsWithChildren) => (...)` — рендерит
      `<Sentry.ErrorBoundary fallback={({ resetError }) => <ErrorState title='...'
      description='...' onRetry={resetError} />}>{children}</Sentry.ErrorBoundary>` (импорт
      `ErrorState` из `@shared/ui`).
- [ ] В `src/app/providers.tsx`: вызвать `initSentry()` один раз на верхнем уровне модуля (до
      определения компонента `Providers`), обернуть `<RouterProvider>` в `<GlobalErrorBoundary>`.
- [ ] Написать тест на `GlobalErrorBoundary` с `vi.mock('@sentry/react', async
      (importOriginal) => ({ ...(await importOriginal()), captureException: vi.fn() }))` —
      частичный мок, реальный `Sentry.ErrorBoundary` остаётся рабочим, а `captureException`
      можно проверить как spy. Дочерний компонент бросает исключение при первом рендере и не
      бросает при повторном (module-level флаг) — проверить: вместо краха показывается
      `ErrorState`-фолбэк (заголовок, кнопка retry), `captureException` вызван, клик по retry →
      дочерний компонент рендерится успешно. Ожидаемо шумный `console.error` от React
      error-boundary логирования — не баг теста.
- [ ] Написать тест на happy path: без ошибки в детях `GlobalErrorBoundary` рендерит `children`
      как есть, `captureException` не вызван.
- [ ] Написать тест на `providers.tsx`, мокая `./router` (лёгкий фейковый router-объект — не
      нужно тянуть реальные страницы/MSW) и `./sentry` (`vi.mock('./sentry')`): проверить, что
      `initSentry` вызван при импорте модуля, и что рендер `<Providers />` оборачивает вывод в
      разметку `GlobalErrorBoundary` (напр. через `vi.mock('./GlobalErrorBoundary')` со
      спай-компонентом, отдающим детей с маркер-атрибутом).
- [ ] `make test` — проходит.

### Task 4: Env-плейсхолдеры

**Files:**

- Modify: `.env.local`
- Modify: `.env.example`

- [ ] В `.env.local` добавить `VITE_SENTRY_DSN=`, `SENTRY_AUTH_TOKEN=`, `SENTRY_ORG=`,
      `SENTRY_PROJECT=` с плейсхолдер-значениями (или пустыми — по образцу существующих строк).
- [ ] В `.env.example` — те же четыре переменные с явными плейсхолдерами (`<...>`), по образцу
      уже существующих строк.
- [ ] Тестов не требует (статические файлы конфигурации, не код).

### Task 5: Документация — AGENTS.md и roadmap.md

**Files:**

- Modify: `AGENTS.md`
- Modify: `plans/roadmap.md`

- [ ] В `AGENTS.md` добавить раздел «Error tracking (Sentry)» рядом с существующими
      тематическими разделами: `initSentry()` вызывается только при `PROD && VITE_SENTRY_DSN`
      (`src/app/sentry.ts`); где живёт `GlobalErrorBoundary` и почему это отдельный компонент, а
      не правка `shared/ui/ErrorBoundary`; список env-переменных (`VITE_SENTRY_DSN` —
      клиентская, безопасно светить в бандле; `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`
      — билд-тайм, читаются в `vite.config.ts` через `loadEnv`, в браузерный бандл не попадают,
      плагин активируется только при `command === 'build'` + все три заданы); что release
      строится один раз в `vite.config.ts` (версия из `package.json` через `fs.readFileSync`,
      не `process.env.npm_package_version` — работает одинаково в `make build`/`make
      build-only`/CI) и одна и та же строка идёт и в `Sentry.init`, и в
      `sentryVitePlugin({ release })`; что `sourcemap` — `'hidden'` только когда плагин
      активен, иначе `false`, и `filesToDeleteAfterUpload` подчищает `dist/`; что `beforeSend`
      вырезает `X-API-KEY` как defense-in-depth, и отдельно — принятое ограничение про
      `VITE_API_KEY`, инлайненный в бандл (см. Solution Overview) вне скоупа этого плана; что
      трейсинг (`browserTracingIntegration`) сознательно не подключён — предмет `2.5.2`.
- [ ] В `plans/roadmap.md` отметить чекбоксы `2.5.1` (`- [ ]` → `- [x]`) после завершения всех
      задач этого плана.
- [ ] Тестов не требует.

### Task 6: Верификация и перенос плана

- [ ] `pnpm exec tsc -b` — чисто (реальный typecheck, см. Context).
- [ ] `make test` — весь набор тестов проходит.
- [ ] `make build` без `SENTRY_*` в окружении (текущее состояние `.env.local` — плейсхолдеры):
      плагин не подключается (`sentryEnabled === false`), билд не падает, `find dist -name
      '*.map'` — пусто, ни в одном чанке нет `//# sourceMappingURL=`.
- [ ] Собрать ещё раз с фиктивными `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` (заведомо
      невалидные значения) — убедиться, что `sentryVitePlugin` реально активируется (в логе
      сборки видны его сообщения) и *не* роняет билд на невалидном токене (401) благодаря
      `errorHandler`; `find dist -name '*.map'` — пусто и в этом сценарии (файлы должны быть
      удалены после — неудачной — попытки аплоада; если `sentry-cli` не подчищает их при
      ошибке сети/авторизации, зафиксировать это как ⚠️ и решить по месту — либо явный
      `try/finally` вокруг сборки не нужен, т.к. `filesToDeleteAfterUpload` — это post-build
      хук самого плагина, а не post-upload).
- [ ] Проверить все чекбоксы плана и `plans/roadmap.md` отмечены.
- [ ] Переместить этот файл в `docs/plans/completed/`.

## Post-Completion

_Требует ручных действий вне этого репозитория/кода:_

- Создать проект в Sentry (React/Vite platform), получить реальный **DSN** → вписать в
  `.env.local` вместо плейсхолдера.
- Создать **Auth Token** (Organization Settings → Auth Tokens, scope `project:releases` +
  `project:write` для sourcemaps) и узнать **org/project slugs** → вписать в `.env.local`.
- Добавить `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` как **GitHub Actions secrets** и
  прокинуть их в `env:` шага `build` в `.github/workflows/ci.yml` (сейчас туда ничего не
  передаётся) — иначе `make build-only` в CI никогда не аплоадит sourcemaps, только локальные
  сборки разработчиков с заполненным `.env.local`.
- Собрать prod-бандл с реальными кредами (`make build`), убедиться в дашборде Sentry, что:
  - source maps загружены и ошибки в проде деминифицируются до исходных `.tsx`;
  - release в Sentry — ровно `kinoshka@<version>+<sha>`, и артефакты sourcemaps привязаны к
    этому же release (не к голому SHA);
  - в событии ошибки нет заголовка `X-API-KEY` (спровоцировать реальную ошибку с фейковым
    API-вызовом и проверить `request.headers` в Sentry UI).
- (Опционально, по желанию) — оценить целесообразность `2.5.2`-работы (`wrapCreateBrowserRouter`
  + `reactRouterBrowserTracingIntegration`) отдельным пунктом, когда дойдёт очередь до Web
  Vitals/трейсинга — не мешать в этот план.
