# Performance budgets + bundle visualization (роадмап 2.5.3)

## Overview

Реализовать пункт `2.5.3` из `plans/roadmap.md:417-433`: превратить размер бандла из
неотслеживаемой величины в измеряемый, бюджетируемый и наглядный показатель — до того, как
приложение уйдёт в публичный релиз.

Сейчас (проверено в этой сессии, `make build-only`, коммит `4486d63`) весь код приложения —
6 страниц, `react-router`, `@sentry/react`, `zod` и т.д. — уходит в **один** чанк:

```
dist/assets/index-CSXhE34Y.js       555.28 kB │ gzip: 172.67 kB
dist/assets/web-vitals-DeMeTfdp.js    8.48 kB │ gzip:   3.30 kB   (единственный существующий code-split)
dist/assets/index-CXzY_p-H.css       56.10 kB │ gzip:  10.27 kB
```

Rolldown сам предупреждает об этом при билде («Some chunks are larger than 500 kB»). Без
route-based code splitting бюджетировать «per-route chunk» из чек-листа роадмапа физически
невозможно — такого чанка просто не существует. Поэтому этот план делает роадмап-пункты в
другом порядке, чем они перечислены в `roadmap.md`: сначала code splitting (создаёт чанки),
затем визуализация (даёт увидеть, что получилось), и только потом бюджеты (измеряют то, что
реально появилось) — числа "с потолка" нет, они снимаются с настоящей post-split сборки.

**Из заметки роадмапа "как лучше" в скоуп этого плана НЕ входит** `bundle-stats-action`
(комментирование diff размера бандла прямо в PR) — это отдельная GitHub App/токен-интеграция,
не упомянутая явно в чек-листе `2.5.3`; `size-limit`'s CI-job (fail при превышении) уже даёт
основной сигнал. Оставлено как возможное будущее улучшение в Post-Completion.

**Отклонения от буквальной формулировки роадмапа (зафиксированы явно, по конвенции AGENTS.md —
см. пример `useRecommendedMovies` vs `useRecommendations`):**

- Роадмап пишет "mode `--analyze`"; план использует `ANALYZE`-env-флаг — композится с уже
  существующим `loadEnv`/`isSentryEnabled`-паттерном в `vite.config.ts`, не заводит второй
  механизм резолва режима.
- Роадмап пишет "лимиты на … per-route chunk" (одна категория); после ревью плана выяснилось,
  что один glob-паттерн на все страничные чанки *суммирует* их размеры, а не берёт максимум —
  бюджет получился бы бессмысленным (одна раздутая страница прячется за пятью лёгкими). План
  вместо этого даёт **отдельный бюджет на каждый из 6 именованных страничных чанков**.
- Роадмап называет пакет `@size-limit/preset-app`; план использует `@size-limit/file` — у
  `preset-app` есть плагин `@size-limit/time` (headless Chrome/`estimo`), не нужный, когда
  бюджет — только байты, не время выполнения; лишний вес и потенциальная нестабильность в CI.

## Context (from discovery)

- **Бандлер — Rolldown, не Rollup.** Установленный `vite@8.0.14` реэкспортирует типы из пакета
  `rolldown` (`node_modules/vite/dist/node/index.d.ts`): `build.rollupOptions` помечен
  `@deprecated Use rolldownOptions instead`, оба поля типизированы одинаково как
  `RolldownOptions`. `vite.config.ts` уже импортирует `@rolldown/plugin-babel` — этот стек уже
  на Rolldown, а не на классическом Rollup.
- **`output.codeSplitting`** (не `advancedChunks`!) — актуальный Rolldown-нативный API
  группировки чанков. В типах `rolldown@1.0.2`
  (`node_modules/.pnpm/rolldown@1.0.2/node_modules/rolldown/dist/shared/define-config-*.d.mts`)
  `advancedChunks` сам помечен `@deprecated Please use output.codeSplitting instead`, с
  предупреждением "если заданы оба — `advancedChunks` игнорируется". `codeSplitting` принимает
  `{ groups: [{ name, test, ... }] }` — тот же декларативный shape, что и у `advancedChunks`,
  просто под текущим именем; собственный пример в докблоке — ровно vendor-группа
  (`{ name: 'vendor', test: /node_modules/ }`).
- **`chunkFileNames` — глобальный паттерн на ВСЕ чанки**, не только на выбранные вручную.
  `[name]` в нём — это либо явное имя группы из `codeSplitting.groups`, либо (для чанков без
  группы) имя, «выведенное из содержимого чанка» — для страниц, импортируемых через одинаковый
  барель `index.tsx` (`import('../pages/home')` → `src/pages/home/index.tsx`), это создаёт риск
  коллизии имён (`page-index-*.js`, `page-index2-*.js`, …). План поэтому не использует
  `chunkFileNames` отдельно — вместо этого у каждой страницы и у vendor свой явный `name` в
  `codeSplitting.groups` (см. Technical Details), а дефолтный `[name]-[hash].js` подхватывает
  это имя без доп. настройки.
- **`.oxlintrc.json` → `"no-explicit-any": "error"`**, при этом `lint-staged` гоняет `oxlint
  --fix --deny-warnings` pre-commit — любая сигнатура с литеральным `any` не закоммитится.
- **`src/app/router.tsx`** — все 6 роутов (`HomePage`, `MoviePage`, `FavoritesPage`,
  `PopularPage`, `RecommendationsPage`, `SearchPage`) импортируются статически. Единственный
  `import()` во всём `src/` — `import('web-vitals')` в
  `src/shared/lib/analytics/reportWebVitals.ts`.
- **Все 6 page-слайсов экспортируют компонент именованным экспортом**, не `default`
  (проверено — `src/pages/*/index.tsx` содержат ровно `export { XPage } from './XPage'`).
  `React.lazy()` ожидает модуль с `default`-экспортом → прямой `lazy(() => import('../pages/home'))`
  не сработает без адаптера.
- **`src/app/layouts/AppLayout.tsx`** — единственная точка с `<Outlet />` (строка 222), через
  которую проходят все роуты (`AppLayout` — layout-route в `router.tsx`). Это единственное
  место, где нужен один `<Suspense>`-боундари для JS-чанков страниц — не по одному на роут.
  Существующий `<AsyncBoundary>` внутри каждой страницы (см. AGENTS.md, "Loading / Empty / Error
  везде") решает *данные*-Suspense, этот план добавляет отдельный, более внешний
  *код*-Suspense — они не конфликтуют и не заменяют друг друга.
- **`src/app/layouts/AppLayout.test.tsx`** рендерит `AppLayout` с `<div>`-плейсхолдерами вместо
  реальных страниц (`MemoryRouter` + `<Routes>` вручную, не импортирует `router.tsx`) —
  code splitting в `router.tsx` не задевает этот тест. `src/app/providers.test.tsx` мокает
  `./router` целиком (`vi.mock('./router', () => ({ router: {} }))`) — тоже не задет. Других
  тестов, монтирующих реальный `router` объект, не найдено (`grep -rl
  "createBrowserRouter|RouterProvider" src --include="*.test.tsx"` → только эти два файла).
- **`src/shared/lib/`** — конвенция модуля: директория `<name>/` с `<name>.ts` + `index.ts`
  (барель) + `<name>.test.ts`, реэкспортированная из `src/shared/lib/index.ts` (см.
  `debounce/`, `sessionCache/`, `storage/`, `viewport/`, `analytics/`).
- **`vite.config.ts`** уже содержит прецедент условного плагина: `sentryEnabled =
  isSentryEnabled({ command, env })` — плагин добавляется в массив `plugins` только при
  `command === 'build'` и наличии всех кредов. Новый `rollup-plugin-visualizer` следует тому же
  паттерну (условие — явный флаг `ANALYZE`, не всегда, чтобы не тратить время на обычных
  билдах/в CI).
- **`Makefile`** — единственная точка входа по AGENTS.md ("Prefer `make` over direct `pnpm`
  calls"); каждая новая команда (`analyze`, `size`, `knip`) добавляется туда, не только в
  `package.json` scripts.
- **`.github/workflows/ci.yml`** — существующие jobs: `lint`/`typecheck`/`test`/`audit`
  (параллельно), `build` (`needs: [lint, typecheck, test]`, требует Sentry-секреты для
  source-map upload). Новые `size`/`knip` jobs встают рядом с `audit` — самостоятельные,
  не продлевают критический путь `build`.
- **`AGENTS.md`** документирует каждое крупное архитектурное решение отдельным разделом
  (Sentry, Web Vitals + Analytics) с WHY на русском — этот план должен оставить такой же
  раздел после реализации.
- **Установленный `react-router@^8.3.0`** (не `^7.15.1`, как написано в AGENTS.md, раздел
  "Routing" — документация устарела, не относится к скоупу этого плана, но обнаружено при
  сверке `package.json`) имеет нативное свойство `route.lazy` для ленивой загрузки роутов,
  которое обошлось бы без `lazyNamed`/ручного `<Suspense>` и интегрируется с
  `useNavigation()`/router-level pending-состоянием. Роадмап явно называет `React.lazy` —
  план придерживается этого и не переключается на `route.lazy`, но это осознанный выбор, а не
  то, что альтернатива не существовала.
- **`src/pages/home/ui/Home/Home.test.tsx`** — пример MSW-хендлеров, которые `Home` (и, через
  неё, `HomePage`) реально бьёт: `*/v1.5/movie` (рейлы, `useTopRatedMovies`/`useNewMovies`) и
  `*/v1.5/list/:slug` (`usePopularMovies`). `src/test/setup.ts` запускает MSW с
  `onUnhandledRequest: 'error'` — любой реальный рендер `HomePage` без этих хендлеров упадёт по
  сетевой ошибке, а не по причине, связанной с code splitting.
- **Прецедент `sentry.config.ts` (AGENTS.md, раздел "Sentry") — не "конфиг без тестов", а
  "чистая логика вынесена в отдельный модуль ради тестов".** `buildRelease()`,
  `isSentryEnabled()`, `resolveBuildSourcemap()` специально живут в `sentry.config.ts` (не
  инлайн в `vite.config.ts`) именно потому, что так у них есть `sentry.config.test.ts`.
  Непокрытым тестами остаётся только то, что реально не тестируется (сайд-эффекты — `execSync`,
  `readFileSync`). Этот план обязан повторить тот же приём для своих чистых предикатов
  (`ANALYZE`-гейт, резолв `codeSplitting.groups`), а не объявлять всю конфигурацию бандлера
  "нетестируемой" по аналогии — см. Task 3/4 ниже.

## Development Approach

- **Testing approach**: Regular (код → тесты), как в предыдущих завершённых пунктах роадмапа
  (`docs/plans/completed/20260910-web-vitals-analytics.md`, `20260905-sentry-error-tracking.md`).
- **Оговорка про тесты в этом плане** (уточнена после ревью — см. прецедент `sentry.config.ts`
  в Context выше): часть задач здесь — чистая декларативная конфигурация без ветвлений
  (`knip.json`, секция `size-limit` в `package.json`, `ci.yml`) — для неё юнит-тестов
  действительно не существует, проверка — запуск соответствующей `make`-команды. Но там, где
  есть настоящая логика с условиями (гейт `ANALYZE`, резолв групп `codeSplitting`, сам
  `lazyNamed`), эта логика выносится в тестируемый модуль по образцу `sentry.config.ts`, а не
  объявляется "конфигом без тестов". Каждая задача помечает явно, к какой категории относится.
- Каждая задача завершается зелёным `make test` (где применимо) или зелёным прогоном своей
  make-команды перед переходом к следующей.
- Числа size-limit budgets снимаются с реальной post-split сборки (Task 5), не оценкой "на
  глаз" — измеренный размер + 15% буфер (середина диапазона 10-20%, который называет роадмап).

## Testing Strategy

- **Unit-тесты**: `lazyNamed` (Task 1) — успешный резолв именованного экспорта + проброс
  реджекта. Smoke-тест `router.tsx` (Task 2) — доказывает, что lazy+именованный экспорт
  реально резолвится через настоящий router, не только в изоляции.
- **Regression-проверка**: полный `make test` после Task 2 (роутинг — самое рискованное
  изменение в этом плане) и в финале (Task 9).
- **E2E**: в проекте нет Playwright/Cypress (`2.5.5` — отдельный, ещё не реализованный пункт
  роадмапа) — не применимо.
- **Build-верификация вместо тестов** (Tasks 3-7): `make build-only`/`make analyze`/`make
  size`/`make knip` — реальная команда, реальный вывод, глазами проверенный результат.

## Progress Tracking

- Отмечать выполненные пункты `[x]` сразу по завершении.
- Новые обнаруженные задачи — с префиксом ➕.
- Блокеры — с префиксом ⚠️.
- План обновляется, если реализация отклоняется от исходного скоупа.

## Solution Overview

1. **Code splitting первым.** `React.lazy()` по каждому из 6 роутов + один `<Suspense>` вокруг
   `<Outlet/>` в `AppLayout`. Named-export адаптер (`lazyNamed`) — маленький переиспользуемый
   хелпер в `@shared/lib`, а не 6 копий одного и того же `.then(m => ({ default: m.X }))`.
2. **Стабильный vendor-чанк + явные имена страничных чанков.**
   `build.rolldownOptions.output.codeSplitting.groups` в `vite.config.ts` — одна запись
   `vendor` (`test: /node_modules/`) и одна запись на каждую из 6 страниц (`test` — путь к её
   директории, `name` — явный, например `page-home`). Явные имена вместо
   выведенных-из-содержимого убирают риск коллизии на одинаковых барелях (`index.tsx`, см.
   Context) и дают size-limit (Task 5) предсказуемые файлы для каждой страницы отдельно —
   не общий glob, который суммирует размеры всех шести.
3. **Визуализация** — `rollup-plugin-visualizer`, включается явным флагом (`ANALYZE=true`), не
   на каждом билде — генерирует `dist/stats.html` (treemap), удобно смотреть, что реально попало
   в каждый чанк после Task 2-3.
4. **Бюджеты** — `size-limit` + `@size-limit/file` (см. отклонение от `@size-limit/preset-app`
   в Overview), конфиг в `package.json`. Отдельная запись на `entry`, на `vendor` и на каждую из
   6 страниц — числа измеренный post-split размер + 15%.
5. **`knip`** — отдельный от size-limit инструмент (детектор мёртвого кода, не размера) — тот же
   принцип "explicit решение", но для неиспользуемых экспортов/зависимостей/файлов, а не байтов.
6. **CI** — оба инструмента получают свой job в `ci.yml`, по образцу существующего `audit`.

## Technical Details

- `codeSplitting.groups` (в `build.rolldownOptions.output`, не `advancedChunks` — см. Context):
  `[{ name: 'vendor', test: /node_modules/ }, { name: 'page-home', test: /\/pages\/home\// },
  { name: 'page-movie', test: /\/pages\/movie\// }, ...]` — по одной записи на каждую из 6
  страниц + `vendor`. Уточнить/расширить (например, отдельная группа для крупного
  `@sentry/react`) только если после Task 3 в `dist/stats.html` (Task 4) видно, что это
  оправдано — не заранее.
- **Пул чистой логики, выносимой в тестируемый модуль** (по образцу `sentry.config.ts` —
  см. Context): `isAnalyzeEnabled({ command, env })` (Task 4, тот же shape, что
  `isSentryEnabled`) и, если резолв `codeSplitting.groups` обрастёт условной логикой сверх
  статического литерала — она тоже туда. Пока группы статичны, отдельного модуля для них не
  нужно; если понадобится (см. Task 3), называть по аналогии — `bundle.config.ts` в корне,
  рядом с `sentry.config.ts`.
- `lazyNamed<P extends object>(factory: () => Promise<Record<string, ComponentType<P>>>, exportName: string): LazyExoticComponent<ComponentType<P>>` —
  обёртка `React.lazy(() => factory().then(m => ({ default: m[exportName] })))`. Без `any`
  (`.oxlintrc.json`: `"no-explicit-any": "error"`) — `P extends object` достаточно для дженерик-
  безопасности без литерального `any`.
- `size-limit` в `package.json`: по записи на `entry`/`vendor`/каждую из 6 страниц (8 записей
  всего), каждая — измеренный текущий размер + 15%, `gzip: true`, `path` (не `import`).
- `knip.json`: `entry` включает не только `src/main.tsx`, но и root-конфиги (`vite.config.ts`,
  `sentry.config.ts`, `apicraft.config.ts`) и `*.test.{ts,tsx}` — иначе knip массово считает их
  и большинство devDependencies (vitest, msw, testing-library, oxlint, husky, commitlint,
  apicraft) неиспользуемыми. `ignore` — сгенерированные файлы (`src/shared/api/*.gen.ts`) и
  любые точки, которые AGENTS.md прямо документирует как намеренно без потребителя (например
  `add(id)` в `useFavorites`, флаги `FeatureName`, оставленные `false` без подключения) — их
  knip не должен предлагать удалить; список уточняется по факту первого прогона (Task 6).

## What Goes Where

- **Implementation Steps** — весь код/конфиг/тесты этого плана достижимы внутри репозитория.
- **Post-Completion** — реальный прогон новых CI jobs на настоящем PR (нельзя проверить локально
  до пуша), возможное будущее подключение `bundle-stats-action`.

## Implementation Steps

### Task 1: `lazyNamed` — хелпер для `React.lazy()` над named-export модулями

**Files:**

- Create: `src/shared/lib/lazyNamed/lazyNamed.ts`
- Create: `src/shared/lib/lazyNamed/lazyNamed.test.ts`
- Create: `src/shared/lib/lazyNamed/index.ts`
- Modify: `src/shared/lib/index.ts`

- [x] реализовать `lazyNamed<P extends object>(factory, exportName)` в `lazyNamed.ts` —
      `React.lazy(() => factory().then(m => ({ default: m[exportName] })))`; все 6
      page-слайсов экспортируют компонент именованным экспортом (`export { XPage } from
      './XPage'`), не `default`, поэтому голый `React.lazy(() => import(...))` не подходит.
      Без `any` в сигнатуре (`.oxlintrc.json`: `"no-explicit-any": "error"`, `oxlint --fix
      --deny-warnings` в pre-commit) — см. Technical Details
- [x] реэкспортировать из `src/shared/lib/lazyNamed/index.ts`
- [x] добавить в публичный барель `src/shared/lib/index.ts`
- [x] написать тест: `lazyNamed` резолвит компонент из именованного экспорта мокнутого модуля
      (успешный кейс — рендер через `React.Suspense`, дождаться появления контента)
- [x] написать тест: реджект промиса `factory` пробрасывается наружу (та же семантика, что у
      голого `React.lazy` — ловится `ErrorBoundary`, не глушится тихо)
- [x] `make test` — оба новых теста и весь набор проходят, прежде чем переходить к task 2

### Task 2: Route-based code splitting в `router.tsx` + Suspense-боундари в `AppLayout`

**Files:**

- Modify: `src/app/router.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`
- Create: `src/app/router.test.tsx`

- [x] заменить все 6 статических импортов страниц в `router.tsx` на
      `lazyNamed(() => import('../pages/home'), 'HomePage')` и аналогично для остальных пяти
      (`MoviePage`, `FavoritesPage`, `PopularPage`, `RecommendationsPage`, `SearchPage`)
- [x] обернуть `<Outlet />` в `AppLayout.tsx` (строка 222) в `<Suspense fallback={<Spinner
      />}>` (`Spinner` уже есть в `@shared/ui`) — единая точка на всё дерево роутов, отдельно от
      `AsyncBoundary`-Suspense внутри каждой страницы (тот про данные, этот про JS-чанк)
- [x] **Осознанное решение по риску "Suspense во время react-router transition"**: навигации
      react-router оборачиваются в `startTransition` (тот же механизм, что уже описан в
      AGENTS.md для `useDeferredValue`/`useSearchParams`). Из-за этого при **переходе между
      страницами** (не при первой загрузке) React не показывает `fallback` немедленно — он
      задерживает коммит всего дерева, включая `AppLayout` (значит, и `activeNav`-подсветку в
      `Header`/`BottomNav`, и эффект `trackPageview()`, см. `AppLayout.tsx:205-207`), до
      резолва чанка. `<Spinner/>`-fallback из предыдущего пункта поэтому реально виден только
      на первой загрузке приложения, не при переходах — на медленной сети переход временно
      выглядит как зависший UI без индикации. План принимает это поведение как есть (страничные
      чанки — единицы KB, не секунды загрузки), но фиксирует WHY-заметку про это в AGENTS.md
      (Task 8) — не как молчаливый побочный эффект. Решение зафиксировано здесь; сама
      WHY-заметка в AGENTS.md добавляется в Task 8, как и запланировано
- [x] добавить MSW-хендлеры для `*/v1.5/movie` и `*/v1.5/list/:slug` в
      `src/app/router.test.tsx` (по образцу `src/pages/home/ui/Home/Home.test.tsx`) — `src/test/setup.ts`
      запускает MSW с `onUnhandledRequest: 'error'`, и smoke-тест ниже реально рендерит
      `HomePage` (через настоящий `router.tsx`), которая бьёт в оба этих эндпоинта
- [x] написать smoke-тест `src/app/router.test.tsx`: рендер настоящего `router` (импорт из
      `./router`, не мок) в `<RouterProvider>` на `/`, дождаться (`findBy`, не `getBy` — контент
      приходит асинхронно после загрузки чанка) отрисовки контента `HomePage`
- [x] `make test` — убедиться, что `AppLayout.test.tsx`/`providers.test.tsx` (используют
      плейсхолдеры/полный мок роутера, этим изменением не задеты) и весь остальной набор
      страничных тестов остаются зелёными
- [x] `make test` зелёный — обязательное условие перед task 3 (самое рискованное изменение
      плана — роутинг всего приложения)

### Task 3: Vendor-чанк + явные имена страничных чанков (`vite.config.ts`)

**Files:**

- Modify: `vite.config.ts`

- [x] добавить `build.rolldownOptions.output.codeSplitting.groups` — запись `{ name: 'vendor',
      test: /node_modules/ }` + по одной явной записи на каждую из 6 страниц (`test` — путь к её
      директории в `src/pages/`, `name` — например `page-home`); НЕ `advancedChunks`
      (задеприкейчен в пользу `codeSplitting` в установленном `rolldown@1.0.2`, см. Context) и
      НЕ отдельный `chunkFileNames` (глобальный паттерн, сломал бы имя vendor-чанка — см.
      Context)
- [x] `make build-only` — убедиться, что в `dist/assets/` теперь `vendor-*.js` + 6 файлов
      `page-home-*.js`/`page-movie-*.js`/… (по имени каждой группы) вместо одного `index-*.js`
      на 555 kB; также заметить (не обязательно фиксить сейчас — см. Post-Completion), что CSS
      тоже расщепляется на entry + по файлу на страницу (сейчас единый `index-*.css`, 56 kB)
- [x] тест не пишем — статический литерал групп без условной логики (см. Development Approach);
      проверка — сам факт появления ожидаемых чанков в `dist/`
- [x] воспроизводимый `make build-only` (стабильный набор чанков, без "плавающих" суффиксов от
      коллизии имён) — обязательное условие перед task 4

### Task 4: `rollup-plugin-visualizer` — визуализация состава бандла

**Files:**

- Modify: `package.json` (devDependencies)
- Modify: `vite.config.ts`
- Modify: `sentry.config.ts` (или новый `bundle.config.ts` рядом — см. ниже)
- Create: `<тот же файл>.test.ts` (тест на новый предикат)
- Modify: `Makefile` (не забыть добавить новый таргет и в строку `.PHONY: ...` на первой строке
  файла — сейчас там перечислены все существующие таргеты явным списком)

- [x] `pnpm add -D rollup-plugin-visualizer`
- [x] вынести `isAnalyzeEnabled({ command, env })` — чистый предикат `command === 'build' &&
      env.ANALYZE === 'true'` — в тестируемый модуль, по образцу `isSentryEnabled` (см. Context
      про прецедент `sentry.config.ts`): либо добавить туда же (тот же файл, та же причина
      тестируемости), либо в новый `bundle.config.ts` в корне, если хочется не мешать
      Sentry-специфичный модуль с bundle-специфичным — выбрать по факту, не критично.
      Реализовано в новом `bundle.config.ts`, отдельно от `sentry.config.ts`
- [x] написать тест на `isAnalyzeEnabled`: `true` только при `command==='build' &&
      ANALYZE==='true'`, `false` в остальных комбинациях (dev, test, `ANALYZE` не задан/не
      `'true'`). Реализовано в `bundle.config.test.ts`
- [x] добавить `visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true,
      template: 'treemap' })` в `plugins`, включать по `isAnalyzeEnabled({ command, env })`
- [x] ⚠️ **риск совместимости**: `rollup-plugin-visualizer` — Rollup-плагин
      (`renderChunk`/`generateBundle`/`getModuleInfo`), Rolldown-совместимость не гарантирована
      на 100%. Если `make analyze` не даёт вменяемого module-level breakdown (падает, либо
      treemap пустой/некорректный) — фоллбэк: `vite-bundle-visualizer` (обёртка, у которой уже
      есть отдельная Rolldown-поддержка) или собственный вывод Rolldown (`--profile`/аналог,
      уточнить в `rolldown.rs` на момент реализации). Не блокировать план на этом — зафиксировать
      выбор и идти дальше.
      Риск не реализовался: `rollup-plugin-visualizer` отработал на Rolldown-сборке без ошибок,
      фоллбэк не потребовался
- [x] добавить `analyze` в `Makefile`: `ANALYZE=true pnpm exec vite build`
- [x] прогнать `make analyze`, глазами убедиться, что `dist/stats.html` открывается и treemap
      отражает `vendor`/`page-*` чанки из Task 3 (не один монолитный блок).
      Подтверждено: `dist/stats.html` (486 KB) сгенерирован, в нём присутствуют отдельные
      top-level узлы `vendor-*.js` и все 6 `page-*-*.js` чанков (не единый монолитный блок)
- [x] `make test` — новый тест на `isAnalyzeEnabled` зелёный, весь набор не сломан
- [x] `make analyze` генерирует валидный `stats.html`, `make test` зелёный — обязательные
      условия перед task 5

### Task 5: `size-limit` — бюджеты на entry/vendor/каждую страницу

**Files:**

- Modify: `package.json` (devDependencies + секция `size-limit`)
- Modify: `Makefile` (не забыть добавить новый таргет и в строку `.PHONY: ...` на первой строке
  файла — сейчас там перечислены все существующие таргеты явным списком)

- [x] `pnpm add -D size-limit @size-limit/file` — не `@size-limit/preset-app` (см. отклонение в
      Overview: `preset-app` тащит `@size-limit/time`, запускающий headless Chrome/`estimo` —
      не нужно, когда бюджет только про байты)
- [x] `make build-only` — снять реальные post-split размеры каждого из 8 чанков (числа baseline
      в Overview — из сборки ДО Task 2-3, устарели и не годятся как бюджет).
      Измеренные gzip-размеры: entry 2.38 kB, vendor 140.43 kB, page-home 18.70 kB,
      page-movie 7.59 kB, page-favorites 1.09 kB, page-popular 1.07 kB,
      page-recommendations 1.41 kB, page-search 8.52 kB
- [x] добавить секцию `"size-limit"` в `package.json` — **8 отдельных записей** с `path`-glob
      (не `import` — с `@size-limit/file` `import`-режима вообще нет, только `path`, значит
      size-limit только *мерит* уже собранный `dist/`, не пересобирает его сам): `entry`
      (`dist/assets/index-*.js`), `vendor` (`dist/assets/vendor-*.js`), и по одной записи на
      каждую из 6 страниц (`dist/assets/page-home-*.js`, `dist/assets/page-movie-*.js`, …,
      имена — из явных групп `codeSplitting` в Task 3, не суммирующий glob) — `gzip: true`;
      лимит каждой записи = её измеренный размер + 15%.
      Итоговые лимиты (измеренный gzip + 15%, округлено): entry 2.75 kB, vendor 162 kB,
      page-home 21.5 kB, page-movie 8.75 kB, page-favorites 1.3 kB, page-popular 1.25 kB,
      page-recommendations 1.65 kB, page-search 9.8 kB
- [x] добавить `size` в `Makefile`: `pnpm exec size-limit`
- [x] `make size` — все 8 бюджетов проходят на текущей сборке
- [x] тест не пишем — числовые пороги, не код с бизнес-логикой; зелёный `make size` — сама
      проверка
- [x] зелёный `make size` — обязательное условие перед task 6

### Task 6: `knip` — детектор unused exports/deps/files

**Files:**

- Create: `knip.jsonc` (JSON с комментариями — план называет `knip.json`, но knip поддерживает
  `.jsonc` из коробки, и обычный `.json` не может нести обязательные комментарии-ссылки на
  AGENTS.md для `ignore`-записей)
- Modify: `package.json` (devDependencies)
- Modify: `Makefile` (новый таргет `knip` + добавлен в строку `.PHONY: ...`)
- Modify: `src/entities/movie/api/getMoviesPage.ts`, `src/features/catalog-filter/lib/genreMap.ts`,
  `src/features/catalog-filter/lib/searchParams.ts`,
  `src/features/catalog-filter/ui/YearRangeSlider/index.tsx`,
  `src/pages/search/model/useMovieCatalog.ts`, `src/shared/lib/sessionCache/index.ts`,
  `src/shared/lib/sessionCache/sessionCache.ts` — точечно убран лишний `export`/реэкспорт у
  символов, у которых не было ни одного потребителя за пределами их же файла
- Deleted: `src/App.tsx`, `src/App.css`, `src/assets/hero.png`, `src/assets/react.svg`,
  `src/assets/vite.svg` — нетронутый Vite-скаффолд, ни один файл проекта на него не ссылался

- [x] `pnpm add -D knip`
- [x] создать `knip.json` (реализовано как `knip.jsonc`, см. выше): `entry` — `src/main.tsx`
      **+** `*.test.{ts,tsx}` **+** root-конфиги (`vite.config.ts`, `sentry.config.ts`,
      `apicraft.config.ts`, и дополнительно `bundle.config.ts`, появившийся в Task 4 уже после
      того, как был написан этот раздел плана) — без этого knip массово считает тестовые файлы
      неиспользуемыми файлами, а большинство devDependencies (vitest, msw, testing-library,
      oxlint, husky, commitlint, apicraft) неиспользуемыми зависимостями (см. Technical Details);
      `project: ['src/**/*.{ts,tsx}']`; `ignore` для сгенерированных файлов
      (`src/shared/api/*.gen.ts` — `AGENTS.md` явно запрещает их трогать, значит и чистить как
      "unused" нельзя)
- [x] добавить `knip` в `Makefile`: `pnpm exec knip`
- [x] прогнать `make knip`, разобрать реальный вывод: настоящие unused exports/deps/files —
      точечно вычищены (`src/App.tsx` + его CSS/ассеты — забытый Vite-скаффолд без единого
      импортёра; сняли лишний `export` у `fetchCatalogCursor`, `GENRE_LABELS`,
      `FILTER_AND_SORT_URL_KEYS`, `CatalogMode`, `SessionCacheEntry`, у которых был ровно один
      потребитель — тот же файл; убрали мёртвый реэкспорт `YEAR_SLIDER_MAX`/`YEAR_SLIDER_MIN` и
      `SessionCache`/`SessionCacheEntry` из барелей, чьи реальные потребители импортируют напрямую
      из исходного модуля, минуя барель); **экспорты, которые AGENTS.md документирует как
      намеренно без потребителя** (весь `@shared/config` — `useFeatureFlag()`/`FeatureGate`/
      `FeatureName`, см. AGENTS.md "Feature flag not wired") и барели публичного API слайсов
      (`getFilterFromSearchParams`/`CatalogQueryParams` в `catalog-filter`, `UseFavoritesResult` в
      `favorites`, `useTheme`/`UseThemeResult`/`Theme` в `theme`, `ErrorBoundary` в `shared/ui` —
      все они перечислены в AGENTS.md "Key public APIs" как намеренная публичная поверхность
      слайса) — НЕ удалены, занесены в `ignore` в `knip.jsonc` с комментариями-ссылками на
      конкретные разделы AGENTS.md
- [x] тест не пишем — детектор мёртвого кода, не прикладная логика
- [x] чистый `make knip` — 0 находок (кроме двух информационных "Configuration hints" про
      избыточность `src/main.tsx`/`vite.config.ts` в `entry`, которые не влияют на exit code и
      оставлены как есть, поскольку сам план явно требует эти два пути в `entry`) —
      обязательное условие перед task 7 выполнено; дополнительно проверены `pnpm exec tsc -b`,
      `make test` (81 файлов, 664 теста), `oxlint` (правленые файлы + весь репозиторий) и
      `pnpm exec vite build`/`make size` — всё зелёное

### Task 7: CI — jobs `size` и `knip` в `.github/workflows/ci.yml`

**Files:**

- Modify: `.github/workflows/ci.yml`

- [x] добавить job `size` (по образцу существующего `audit`: `actions/checkout` →
      `pnpm/action-setup` → `actions/setup-node` (кэш `pnpm`) → `pnpm install --frozen-lockfile`
      с `HUSKY: '0'`) — запускает `make build-only` (нужен реальный `dist/` для size-limit) и
      `make size`. **Без Sentry-секретов** (в отличие от job `build`) — размер чанков не зависит
      от того, льются ли сорсмапы в Sentry; давать этому job те же секреты означало бы на каждый
      PR ещё раз аплоадить сорсмапы под тем же `release`-тегом — двойной расход квоты и времени
      без всякой пользы (`isAnalyzeEnabled`/`isSentryEnabled` в этом случае просто скипнут
      соответствующие плагины, билд не падает)
- [x] добавить job `knip` (тот же паттерн setup) — `make knip`, без нужды в билде (работает по
      исходникам, быстрее `size`)
- [x] оба job — самостоятельные (свой `pnpm install`), не `needs: [build]` — по образцу `audit`,
      чтобы не удлинять критический путь `build` (`needs: [lint, typecheck, test]`)
- [x] тест не пишем — CI YAML; проверка — синтаксис + реальный прогон на первом PR
      (Post-Completion, до пуша недостижимо)
- [x] локально проверить `.github/workflows/ci.yml` на валидный YAML (`pnpm exec` любого
      YAML-линтера, если есть, иначе визуальная сверка со структурой существующих jobs) — перед
      task 8. Проверено: `js-yaml`/`python3+PyYAML` парсят файл без ошибок, `jobs` содержит
      `lint, typecheck, test, audit, size, knip, build`

### Task 8: Roadmap + AGENTS.md — фиксация решений

**Files:**

- Modify: `plans/roadmap.md`
- Modify: `AGENTS.md`

- [ ] отметить все 6 чекбоксов `2.5.3` в `plans/roadmap.md` как `[x]`, добавить в заголовок
      раздела `— done, см. docs/plans/20260912-performance-budgets-bundle-visualization.md`
      (тот же паттерн, что у `2.3`/`2.4`)
- [ ] добавить в `AGENTS.md` новый раздел (по аналогии с "Error tracking (Sentry)"/"Web Vitals +
      Analytics") — зафиксировать: `lazyNamed` и почему он нужен (named exports, не default),
      Suspense-боундари в `AppLayout` (код vs данные) и принятый риск задержки
      `activeNav`/`trackPageview()` при transition-навигации (см. Task 2), `codeSplitting.groups`
      и почему не `advancedChunks`/`chunkFileNames`, `ANALYZE`-флаг и `make analyze`, реально
      измеренные size-limit-бюджеты (8 записей) и что они baseline+15% (не «с потолка»), почему
      `@size-limit/file` вместо `@size-limit/preset-app`, `knip.json` и его `entry`/`ignore` с
      причиной каждой записи, обновить строку `Makefile`-команд в AGENTS.md (`analyze`/`size`/
      `knip` — новые `.PHONY`-таргеты)
- [ ] `make check` (`format-check` + `lint` + `build`, см. `Makefile`) — финальная валидация
      перед task 9

### Task 9: Verify acceptance criteria

- [ ] все 6 пунктов чек-листа `2.5.3` из `plans/roadmap.md` реализованы
- [ ] `dist/` после `make build-only` не содержит единого монолитного app-чанка — есть `vendor-*.js`
      и по отдельному чанку на каждую из 6 страниц (сравнить с baseline из Overview; не считать
      ровно 6 файлов жёстким критерием — Rolldown может слить/расщепить дополнительно на общих
      зависимостях между страницами, важен факт "не один блок на всё", а не точное число)
- [ ] `make analyze` генерирует `dist/stats.html`, отражающий новую структуру чанков
- [ ] `make size` — зелёный
- [ ] `make knip` — чистый или осознанно заигноренный
- [ ] `make test` — полный набор зелёный
- [ ] `make check` — зелёный

### Task 10: [Final] Обновление документации

- [ ] финальная сверка `AGENTS.md`/`plans/roadmap.md` с фактической реализацией (если что-то
      отклонилось по ходу Task 1-9 — доописать)
- [ ] переместить этот план в `docs/plans/completed/`

## Post-Completion

*Пункты, требующие внешних действий — без чекбоксов, информационно.*

**Требует реального PR (недостижимо локально до пуша):**

- Первый прогон jobs `size`/`knip` в реальном CI на настоящем PR — убедиться, что кэш `pnpm`,
  секреты и тайминги (`< 3 мин` per AGENTS.md) в реальном GitHub Actions окружении совпадают с
  локальным прогоном.
- Если `knip`/`size-limit` на CI-раннере (иное железо/ФС) дают иной результат, чем локально —
  донастроить `ignore`/лимиты по факту.

**Риск, принятый без митигации в этом плане:**

- После code splitting (Task 2) у пользователя с открытой вкладкой после нового деплоя переход
  на ещё не загруженную страницу может упереться в 404 по старому хэшу чанка (файл больше не
  существует на CDN/хостинге). Реджект уйдёт в `GlobalErrorBoundary` как обычная ошибка (и в
  Sentry) — общее для любого SPA с code splitting поведение, отдельно не обрабатывается этим
  планом (типичное решение — перехват конкретной ошибки динамического импорта и `location.reload()`
  — не заводим сейчас, это самостоятельный backlog-пункт при первом реальном инциденте).

**Осознанно вне скоупа этого плана:**

- `bundle-stats-action` (комментирование bundle-diff прямо в PR) — упомянут в заметке "как
  лучше" роадмапа, но не входит в явный чек-лист `2.5.3`; `size-limit`'s CI-fail уже даёт
  основной сигнал о превышении. Кандидат в будущий backlog-пункт, если понадобится более
  наглядный per-PR diff.
