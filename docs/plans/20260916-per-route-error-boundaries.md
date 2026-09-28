# Per-route Error Boundaries (роадмап 2.6)

## Overview

Роадмап-пункт 2.6 «Error boundaries» на данный момент не выполнен: у приложения есть только один,
глобальный `ErrorBoundary` (точнее — `GlobalErrorBoundary`, `Sentry.ErrorBoundary` вокруг всего
`<RouterProvider>` в `providers.tsx`, добавлен позже, в рамках 2.5.1). Проблема — граница одна на
всё дерево: если упадёт компонент внутри конкретной страницы (`/movie/:id`, `/search` и т.д.),
пользователь теряет вообще всё — `Header`/`MobileHeader`+`BottomNav` размонтируются вместе со
страницей, а не только контент страницы.

Цель — дать каждому роуту собственную границу ошибки, не теряя chrome (Header/BottomNav) при
падении конкретной страницы, без дублирования кода по 8 page-слайсам и без потери Sentry-репортинга
для таких ошибок.

**Ключевое архитектурное решение (согласовано с пользователем):**

- Одна точка границы — `AppLayout.tsx`, вокруг `<Outlet/>` (тот же принцип «одна точка, через
  которую проходят все роуты», что уже используется в этом файле для `<Suspense>`/`trackPageview`).
  Никакой новой границы в каждом из 8 `pages/*` (`home`, `search`, `movie`, `person`, `favorites`,
  `popular`, `recommendations`, `profile`) — это было бы дублированием одной и той же
  концепции по всем страницам, вопреки существующему паттерну.
- Переиспользуется существующий `shared/ui/ErrorBoundary` (класс из 0.2) — не новый компонент и не
  `react-error-boundary` (см. «Как лучше» роадмапа).
- Поскольку эта граница перехватывает ошибку раньше, чем она дойдёт до верхнего
  `Sentry.ErrorBoundary` (`GlobalErrorBoundary`), для сохранения Sentry-репортинга
  `shared/ui/ErrorBoundary` получает новый необязательный `onError`-проп, а `AppLayout` передаёт
  туда `Sentry.captureException` через новый хелпер `captureRouteError` в `src/app/sentry.ts`.
- Fallback — существующий `ErrorState` с новым необязательным `secondaryAction?: ReactNode`-слотом
  (не отдельный UI-компонент, и не привязка `ErrorState` к react-router — см. пункт ниже).
- Сброс границы при переходе на другой роут — `key={pathname}` на новом `ErrorBoundary`: смена
  ключа размонтирует/перемонтирует границу, снимая `hasError` автоматически (без ручного эффекта).
  **Принятое следствие** (зафиксировано после ревью плана): `key` ремаунтит не только границу, но
  и всё под ней — `<Suspense><Outlet/></Suspense>`. На `/movie/1 → /movie/2` это означает полный
  ремаунт `MoviePage` (и его собственного `AsyncBoundary`) вместо сохранения старого контента на
  экране во время загрузки нового (react-router оборачивает навигацию в `startTransition` —
  раньше это давало «старый фильм ещё виден, пока грузится новый», теперь — `MovieDetailSkeleton`
  сразу). То же самое на `/person/1 → /person/2` (`PersonPage`, появился после написания плана) —
  полный ремаунт вместо stale-контента. `/search` не задет — там меняется только query, `pathname` стабилен, `key` не меняется,
  stale-content-паттерн `useCatalogUpdateStatus` продолжает работать как раньше. Альтернатива без
  ремаунта (сброс `hasError` через `resetKey`-проп в `getDerivedStateFromProps`, без размонтирования
  детей) сознательно не выбрана — усложняет `shared/ui/ErrorBoundary` ради частного случая, а
  наблюдаемая деградация UX ограничена двумя роутами с динамическим сегментом (`/movie/:id`,
  `/person/:id`) и только навигацией внутри одного и того же роута.

**Две правки по итогам второго ревью (код-ревью от внешнего инструмента, после первого
plan-review-агента):**

1. **`ErrorState` не должен зависеть от react-router.** Исходная версия плана добавляла в
   `ErrorState` булев `homeLink?: boolean`, который сам импортировал `Link` из `react-router` —
   т.е. базовый `shared/ui`-примитив становился контекстно-зависимым (требовал `<Router>` в дереве)
   в зависимости от переданного пропа. План уже фиксировал риск (`GlobalErrorBoundary` рендерит
   `ErrorState` СНАРУЖИ `<RouterProvider>`) и компенсировал его регресс-гард-тестом — но чище не
   создавать этот риск вообще. Решение: `ErrorState` получает нейтральный `secondaryAction?: ReactNode`
   (слот, а не булев флаг с встроенной навигационной логикой), а `<Link to='/'>На главную</Link>`
   собирается в `AppLayout.tsx`, единственном месте, которому эта ссылка нужна. `shared/ui/ErrorState`
   остаётся полностью независимым от роутера, как и все остальные примитивы в `shared/ui`.
2. **Восстановление через «На главную» при chunk-load-ошибке — не гарантировано, а не «единственный
   путь».** Исходная версия плана утверждала, что ссылка на главную — рабочее восстановление для
   ошибок загрузки JS-чанка страницы (2.5.3, `lazyNamed`/`React.lazy`). Это верно только если
   упавший чанк — специфичный для ТЕКУЩЕГО роута; если упал общий `shared`-чанк (используется всеми
   роутами) или собственный чанк `page-home`, переход на `/` наткнётся на тот же закэшированный
   `React.lazy`-rejected-промис и тоже уйдёт в error fallback. Решение — не полагаться на ссылку/retry
   для этого класса ошибок вообще: добавлен глобальный слушатель `vite:preloadError` (Task 5) —
   Vite сам диспатчит это событие на `window` при сбое динамического `import()` чанка (устаревший
   деплой, chunk 404, сетевая ошибка), это официально документированный механизм
   (https://vite.dev/guide/build.html#load-error-handling), надёжнее эвристик по тексту ошибки
   (`error.message` разнится между браузерами). Обработчик делает `window.location.reload()` —
   единственное действительно надёжное восстановление для этого класса ошибок (чистый module cache,
   свежий `index.html` с ссылками на актуальные чанки). Ссылка «На главную» в `ErrorState`-фолбэке
   остаётся как общий «выход» для рантайм/данных-ошибок текущей страницы — она просто больше не
   заявляется как решение конкретно для chunk-load-случая.

## Context (from discovery)

- `src/shared/ui/ErrorBoundary/ErrorBoundary.tsx` — классовый boundary из 0.2, `fallback`-рендер-проп
  `(params: { error, reset }) => ReactNode`, `componentDidCatch` сейчас только логирует в консоль.
- `src/shared/ui/ErrorState/ErrorState.tsx` — `title`/`description`/`onRetry`; кнопка retry
  хардкожена как «Попробовать снова» (единственная русская строка в компоненте — остальные тексты
  приходят через пропы от вызывающей стороны, обычно на английском). Сейчас ничего не импортирует
  из `react-router` — это остаётся так и после плана (см. решение №1 выше). Прямые потребители
  помимо `AsyncBoundary`: `GlobalErrorBoundary`, `MoviePage`, `PersonPage` (404-состояния) — все
  без `secondaryAction`, новый проп опционален и их не задевает.
- `src/shared/ui/AsyncBoundary/AsyncBoundary.tsx` — уже комбинирует `ErrorBoundary` + `Suspense` +
  `ErrorState` для async-секций внутри страниц; новая граница в `AppLayout` — та же композиция
  (`ErrorBoundary` снаружи `Suspense`), но на уровень выше, вокруг `<Outlet/>`, а не внутри страницы.
  Сейчас `AsyncBoundary` используют `Home`, `Search`, `MoviePage`, `PersonPage`, `Favorites`,
  `Popular`, `Recommendations` и `GenreSelector` (`@features/catalog-filter`). Сам
  `shared/ui/ErrorBoundary` напрямую импортирует только `AsyncBoundary`.
- `src/app/GlobalErrorBoundary.tsx` — `Sentry.ErrorBoundary`, оборачивает `<RouterProvider>` в
  `providers.tsx`. Остаётся без изменений — последняя линия защиты для ошибок вне `<Outlet/>`
  (например, в самом `AppLayout`: выбор chrome, `useViewport`, и т.п.). Его WHY-комментарий
  («не правка `shared/ui/ErrorBoundary` — лишний blast radius») и строка в `.claude/rules/sentry.md`
  («`shared/ui/ErrorBoundary` … is intentionally untouched») после Task 1 устаревают: примитив
  получает опциональный `onError`, хотя `AsyncBoundary` его по-прежнему не передаёт. Правится в Task 7.
- `src/app/layouts/AppLayout.tsx` — единая точка для всех роутов; сейчас держит только
  `<Suspense fallback={<Spinner/>}><Outlet/></Suspense>` (code-splitting, роадмап 2.5.3); нет
  собственного CSS-модуля (стили полностью в дочерних виджетах) — план добавляет первый, только
  под стиль ссылки «На главную».
- `src/app/sentry.ts` — уже содержит тестируемые функции (`scrubApiKeyHeader`,
  `scrubProfileNameBreadcrumb`, `scrubProfileNameSpan`, `initSentry`) и прецедент явного
  `Sentry.captureException` (`reportStorageErrorToSentry` — репортер ошибок `createStorageSlot`);
  сюда логично добавить `captureRouteError`, по прецеденту. В `sentry.test.ts` мок `@sentry/react`
  уже содержит `captureException: vi.fn()` — расширять его не нужно.
- `src/app/providers.tsx` — сейчас вызывает на верхнем уровне модуля только `initAnalytics()`:
  `initSentry()` переехал в `src/app/sentry-bootstrap.ts` (первая строка `main.tsx`, порядок
  критичен — см. `.claude/rules/sentry.md`), `reportWebVitals()` удалён вместе с пайплайном Web
  Vitals→Plausible (2.5.7). Сюда по прецеденту `initAnalytics()` добавляется
  `registerChunkPreloadRecovery()` (Task 5). `src/app/providers.test.tsx` мокает модули-зависимости
  и проверяет вызов `initAnalytics` при импорте — туда же добавляется проверка нового вызова.
- `src/main.tsx` — минимальный bootstrap; слушатель `vite:preloadError` сознательно НЕ здесь и не в
  `sentry-bootstrap.ts` (тот — только про порядок `Sentry.init()`), а в `providers.tsx`, где уже есть
  паттерн тестируемых side-effect-вызовов на импорте модуля.
- `src/app/layouts/AppLayout.test.tsx` — тестирует композицию chrome + `<Outlet/>` через
  `createMemoryRouter`+`RouterProvider` (хелпер `renderAt` и отдельный describe про page view
  tracking в конце файла, где роутер монтируется один раз и навигация идёт через
  `router.navigate`). Фикстура роутов в `renderAt` уже содержит `/movie/:id` и `/person/:id`, в
  describe про tracking — `/`, `/favorites`, `/person/:id`. `vi.mock('@shared/lib', …)` мокает
  `trackPageview` (viewport задаётся через `window.innerWidth`) — `vi.mock('../sentry', …)`
  добавляется по тому же образцу.
- Vite 8.2.1 (Rolldown) по-прежнему диспатчит `vite:preloadError` (проверено по `node_modules/vite/dist`).

## Development Approach

- **Тестирование**: Regular (код → тесты, в рамках той же задачи).
- Каждая задача — маленькая, самодостаточная, тесты пишутся сразу после кода в той же задаче.
- Все тесты проходят перед переходом к следующей задаче.
- При запуске через `/planning:exec` брать модель и effort сабагента из строки `**Модель:**` под
  заголовком задачи (`haiku` — простые механические правки, `sonnet` — типовая реализация, `opus` —
  насыщенная логика и финальная приёмка).

## Testing Strategy

- **unit-тесты**: обязательны в каждой задаче — новый `ErrorBoundary.test.tsx` (компонент раньше
  не имел собственного unit-теста, был проверен только транзитивно через `AsyncBoundary.test.tsx`
  — `GlobalErrorBoundary` использует `Sentry.ErrorBoundary`, не `shared/ui/ErrorBoundary`, так что
  транзитивного покрытия оттуда не было), новый `ErrorState.test.tsx` (аналогично — не было
  отдельного файла), расширение `sentry.test.ts`, расширение `AppLayout.test.tsx`, новый
  `chunkPreloadRecovery.test.ts`.
- **e2e-тесты**: не добавляются в рамках этого плана — заброс ошибки в реальный React-компонент
  специально ради e2e-проверки usability не даёт, а Playwright-сьют (2.5.5) итак не покрывает
  «сломанный компонент» сценарии ни у одной другой границы (`AsyncBoundary`, `GlobalErrorBoundary`) —
  это осталось бы единственным исключением без прямой связи с текущим скоупом. Эмулировать реальный
  chunk 404 в Playwright тоже не входит в скоуп — юнит-тест на диспатч `vite:preloadError` достаточен
  для проверки самой логики обработчика.

## Solution Overview

Композиция после изменений (`AppLayout.tsx`):

```
<ErrorBoundary key={pathname} fallback={routeErrorFallback} onError={captureRouteError}>
  <Suspense fallback={<Spinner />}>
    <Outlet />
  </Suspense>
</ErrorBoundary>
```

`routeErrorFallback` — локальная функция в `AppLayout.tsx`:

```tsx
const routeErrorFallback = ({
  error,
  reset,
}: {
  error: Error | null
  reset: () => void
}) => (
  <ErrorState
    title='Something went wrong'
    description={error?.message || 'Please try again later'}
    onRetry={reset}
    secondaryAction={
      <Link className={s.homeLink} to='/'>
        На главную
      </Link>
    }
  />
)
```

`s` — новый `AppLayout.module.css` (только стиль `.homeLink`, тот же паттерн токенов, что был бы у
`.retryButton`: `var(--text-secondary)`, `var(--border-soft)`, `var(--bg-hover)` на hover).

`captureRouteError` — `src/app/sentry.ts`, обёртка над `Sentry.captureException` с прокинутым React
component stack (no-op, если `Sentry.init()` не вызывался — тот же неявный гейт, что и у остальных
Sentry-вызовов в dev/test).

Chrome (`Header`/`MobileHeader`+`BottomNav`) остаётся вне границы — рендерится в `AppLayout` до и
после блока с `ErrorBoundary`, так и продолжает работать при падении контента страницы.

Отдельно, независимо от `ErrorBoundary`/`ErrorState` — `registerChunkPreloadRecovery()`
(`src/app/providers.tsx`, вызывается один раз на верхнем уровне модуля, по прецеденту
`initAnalytics()`): слушает `window`'s `vite:preloadError`, делает `event.preventDefault()` +
`window.location.reload()`. Это событие Vite диспатчит ДО того, как та же ошибка дойдёт как
rejected promise до `Suspense`/`ErrorBoundary` — так что для настоящих chunk-load-сбоев страница в
большинстве случаев успевает перезагрузиться раньше, чем пользователь увидит `ErrorState`-фолбэк
вообще; `ErrorState`'s retry/«На главную» остаются на случай, если слушатель почему-то не
сработал, или ошибка — не chunk-load, а обычная рантайм/данных-ошибка компонента.

**Что НЕ покрывается этим планом (принятые ограничения):**

- Ошибки, пойманные страничными `AsyncBoundary` (rails на главной, `/search`, `/movie/:id`,
  `/person/:id`, `/favorites`, `/popular`, `/recommendations`, `GenreSelector` —
  основной сценарий реальных отказов, обычно сбой данных, а не рендера) — как и раньше, не
  репортятся в Sentry. `AsyncBoundary` не прокидывает `onError` внутреннему `ErrorBoundary`; этот
  план расширяет только новую per-route границу в `AppLayout`, а не `AsyncBoundary`. Ошибка до
  верхнего `GlobalErrorBoundary` тоже не доходит — её перехватывает сам `AsyncBoundary`. Осознанный
  gap, вне скоупа 2.6.
- `vite:preloadError` покрывает только ошибки динамического `import()` (страничные чанки,
  `React.lazy`/`lazyNamed`) — не покрывает, например, сбой загрузки шрифта/иконки или сетевую ошибку
  внутри уже загруженного JS. Для этих случаев `ErrorState`'s retry/«На главную» — штатный путь.

## Technical Details

- `ErrorBoundary`: `onError?: (error: Error, errorInfo: ErrorInfo) => void`, вызывается в
  `componentDidCatch` после существующего `console.error`. Необязательный — не ломает единственного
  текущего потребителя (`AsyncBoundary`, а через него — все `AsyncBoundary`-точки, см. Context),
  который его не передаёт.
- `ErrorState`: `secondaryAction?: ReactNode` (НЕ `homeLink?: boolean`/`Link` — см. решение №1 в
  Overview). Рендерится рядом с кнопкой retry (если есть `onRetry`) внутри общего `.actions`-
  flex-контейнера (сейчас `margin-top` висит на самой `.retryButton` — переносится на контейнер).
  `secondaryAction` без `onRetry` тоже валиден (рендерится он один). Компонент остаётся полностью
  независимым от react-router — `<Link>` создаётся вызывающей стороной (`AppLayout`), а не внутри
  `ErrorState`.
- `captureRouteError(error: Error, errorInfo: ErrorInfo): void` в `src/app/sentry.ts` —
  `Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } }, mechanism: { handled: true } })`.
  Сигнатура берёт `errorInfo`, а не только `error`, чтобы не потерять React component stack — раньше
  эти же ошибки уходили в Sentry через `Sentry.ErrorBoundary`/`captureReactException`, который его
  прикладывает; голый `Sentry.captureException(error)` без `errorInfo` дал бы отчёт хуже, чем был
  до этого плана. `ErrorInfo` — тип из `react`, тот же, что уже в `onError`-пропе `ErrorBoundary`.
- `registerChunkPreloadRecovery(): void` в `src/app/chunkPreloadRecovery.ts`, вызов — в
  `src/app/providers.tsx` (Task 5) —
  `window.addEventListener('vite:preloadError', event => { event.preventDefault(); window.location.reload() })`.
  Вызывается один раз, безусловно (не гейтится `PROD`, в отличие от `initSentry`/`initAnalytics`) —
  само событие `vite:preloadError` в dev-режиме Vite не диспатчит настоящих chunk-load-сбоев (там
  нет билд-чанков), так что регистрация безвредна и в dev, доп. `import.meta.env.PROD`-гейт не нужен.

## What Goes Where

- **Implementation Steps** — код + тесты в этом репозитории.
- **Post-Completion** — нет пунктов, требующих ручных действий вовне (в отличие от, например, CSP
  2.5.4 или E2E 2.5.5).

## Implementation Steps

### Task 1: `onError`-проп в `shared/ui/ErrorBoundary`

**Модель:** `haiku` · effort `medium` — один опциональный проп и четыре теста по готовому паттерну бомбы

**Files:**

- Modify: `src/shared/ui/ErrorBoundary/ErrorBoundary.tsx`
- Create: `src/shared/ui/ErrorBoundary/ErrorBoundary.test.tsx`

- [ ] добавить в `Props` необязательный `onError?: (error: Error, errorInfo: ErrorInfo) => void`
- [ ] вызвать `this.props.onError?.(error, errorInfo)` в `componentDidCatch`, после существующего `console.error`
- [ ] написать тест: без ошибки в детях — рендерит `children`, `onError` не вызван
- [ ] написать тест: ошибка в детях, `onError` передан — вызывается один раз с `(error, errorInfo)`, рендерится `fallback`
- [ ] написать тест: ошибка в детях, `onError` НЕ передан — не падает (проп опционален), `fallback` всё равно рендерится
- [ ] написать тест: `reset()` из `fallback`-параметров возвращает к рендеру `children` после того, как причина ошибки устранена
- [ ] в компоненте-бомбе использовать module-level флаг (не self-flipping внутри рендера) — React синхронно повторяет попытку рендера ещё раз до того, как решит считать её настоящей ошибкой; тот же паттерн уже задокументирован в `AsyncBoundary.test.tsx`/`GlobalErrorBoundary.test.tsx`
- [ ] прогнать тесты — должны проходить перед Task 2

### Task 2: `captureRouteError` в `src/app/sentry.ts`

**Модель:** `haiku` · effort `medium` — тонкая обёртка над `captureException`, мок уже есть

**Files:**

- Modify: `src/app/sentry.ts`
- Modify: `src/app/sentry.test.ts`

- [ ] добавить экспорт `captureRouteError(error: Error, errorInfo: ErrorInfo): void`, вызывающий `Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } }, mechanism: { handled: true } })`
- [ ] короткий WHY-комментарий: перехватывается раньше `GlobalErrorBoundary`, поэтому репортинг явный; `errorInfo`/`componentStack` — чтобы не потерять то, что раньше давал `Sentry.ErrorBoundary`/`captureReactException`
- [ ] в `sentry.test.ts` переиспользовать существующий мок `@sentry/react` (`captureException: vi.fn()` там уже есть — используется тестом репортера localStorage); сбрасывать мок перед новым тестом (`vi.mocked(Sentry.captureException).mockClear()`), чтобы счётчик вызовов не пересекался с тестом репортера
- [ ] написать тест: `captureRouteError(error, errorInfo)` вызывает `Sentry.captureException` ровно один раз с этим `error` и с `contexts.react.componentStack === errorInfo.componentStack`
- [ ] прогнать тесты — должны проходить перед Task 3

### Task 3: `secondaryAction`-слот в `shared/ui/ErrorState`

**Модель:** `haiku` · effort `medium` — слот + перенос `margin-top` на контейнер, простые тесты

**Files:**

- Modify: `src/shared/ui/ErrorState/ErrorState.tsx`
- Modify: `src/shared/ui/ErrorState/ErrorState.module.css`
- Create: `src/shared/ui/ErrorState/ErrorState.test.tsx`

- [ ] добавить `secondaryAction?: ReactNode` в `Props` (НЕ булев `homeLink` — компонент не должен знать про `react-router`/навигацию, только про то, что рядом с retry может стоять произвольный доп. узел)
- [ ] обернуть кнопку retry и `secondaryAction` в новый `.actions`-контейнер (flex, `gap: 8px`), перенести `margin-top` с `.retryButton` на `.actions`; условие рендера контейнера — `onRetry || secondaryAction`
- [ ] написать тест: без `onRetry`/`secondaryAction` — ни кнопки, ни доп. узла нет
- [ ] написать тест: `secondaryAction={<span>custom</span>}` без `onRetry` — рендерится только переданный узел
- [ ] написать тест: `onRetry` + `secondaryAction` одновременно — оба присутствуют, кнопка retry по-прежнему кликабельна и вызывает `onRetry`
- [ ] написать тест: существующее поведение (`onRetry` без `secondaryAction`) не регрессировало — только кнопка retry
- [ ] прогнать тесты — должны проходить перед Task 4

### Task 4: Per-route `ErrorBoundary` в `AppLayout`

**Модель:** `opus` · effort `high` — самая насыщенная задача: `key={pathname}`-ремаунт, взаимодействие с `Suspense`/`AsyncBoundary`, навигационные тесты на data router

**Files:**

- Create: `src/app/layouts/AppLayout.module.css`
- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `src/app/layouts/AppLayout.test.tsx`

- [ ] импортировать `ErrorBoundary`, `ErrorState` из `@shared/ui` (рядом с уже импортируемыми `IconButton`/`ShareIcon`/`Spinner`), `captureRouteError` из `../sentry`, `Link` из `react-router` (добавить в существующий импорт `Outlet`/`useLocation`/… — сам `Link` в файле новый), стили — `import s from './AppLayout.module.css'`
- [ ] создать `AppLayout.module.css` с `.homeLink` (тот же паттерн токенов, что у `.retryButton` в `ErrorState.module.css`: `var(--text-secondary)`, `var(--border-soft)`, `var(--bg-hover)` на hover, без retry-акцентного фона)
- [ ] определить локальную `routeErrorFallback = ({ error, reset }) => <ErrorState title='Something went wrong' description={error?.message || 'Please try again later'} onRetry={reset} secondaryAction={<Link className={s.homeLink} to='/'>На главную</Link>} />`
- [ ] обернуть `<Suspense><Outlet/></Suspense>` в `<ErrorBoundary key={pathname} fallback={routeErrorFallback} onError={captureRouteError}>` (граница снаружи Suspense — тот же порядок, что в `AsyncBoundary`, чтобы ловить и ошибки загрузки чанка, и runtime-ошибки страницы; про ремаунт `Suspense`/страницы на `key={pathname}` см. Overview/Solution Overview). `pathname` уже есть в компоненте (`useLocation()`), новый хук не нужен; обновить существующий JSX-комментарий над `<Suspense>` — упомянуть границу и `key`
- [ ] `<ScrollRestoration/>` и chrome оставить вне `ErrorBoundary`
- [ ] написать тест: страница, бросающая ошибку при рендере — chrome (`Header` на десктопе / `MobileHeader`+`BottomNav` на мобильном) остаётся в дереве, вместо контента страницы — `ErrorState` с текстом ошибки и ссылкой «На главную». Компонент-бомба — с module-level `shouldThrow`-флагом (см. Task 1, не self-flipping внутри рендера)
- [ ] написать тест: клик на «Попробовать снова» в fallback восстанавливает страницу, если причина ошибки устранена (аналог теста `GlobalErrorBoundary.test.tsx`, но здесь — с сохранением chrome вокруг)
- [ ] написать тест: `captureRouteError` (замоканный) вызывается при падении страницы — проверка через `vi.mock('../sentry', ...)`, аналогично мокингу `trackPageview` в этом же файле
- [ ] написать тест: ошибка внутри дочернего `AsyncBoundary` (т.е. страница сама оборачивает падающий кусок в свой `AsyncBoundary`, как `MoviePage`/`Search`/rails) перехватывается ИМ, не новой границей — рендерится страничный фолбэк `AsyncBoundary`, chrome и структура страницы вокруг него целы, `captureRouteError` не вызван (страничные `AsyncBoundary` не прокидывают `onError` — см. принятый gap в Solution Overview)
- [ ] написать тест: навигация с упавшего роута на другой (роутер монтируется один раз через `createMemoryRouter`+`RouterProvider`, навигация — `router.navigate`, как в describe про page view tracking в конце файла) — граница сбрасывается сама (новый роут рендерится нормально, без нужды в retry) благодаря `key={pathname}`
- [ ] написать тест: навигация внутри одного динамического роута (`/person/1` → `/person/2` — `/person/:id` уже есть в фикстуре tracking-describe; компонент-плейсхолдер со счётчиком маунтов в module-level переменной или `useEffect`) — подтвердить фактический ремаунт страницы, задокументированный как принятое следствие в Overview (не регрессия, а зафиксированный факт)
- [ ] прогнать тесты — должны проходить перед Task 5

### Task 5: `registerChunkPreloadRecovery` — авто-перезагрузка при сбое загрузки чанка

**Модель:** `sonnet` · effort `medium` — маленький модуль, но тонкости с моком `window.location.reload` и изоляцией слушателя в jsdom

**Files:**

- Create: `src/app/chunkPreloadRecovery.ts`
- Create: `src/app/chunkPreloadRecovery.test.ts`
- Modify: `src/app/providers.tsx`
- Modify: `src/app/providers.test.tsx`

- [ ] реализовать `registerChunkPreloadRecovery(): void` — `window.addEventListener('vite:preloadError', event => { event.preventDefault(); window.location.reload() })`
- [ ] WHY-комментарий: Vite диспатчит это событие при сбое динамического `import()` чанка (устаревший деплой/chunk 404/сетевая ошибка) ДО того, как та же ошибка дойдёт до `Suspense`/`ErrorBoundary`; `React.lazy` кэширует rejected-промис на модуль — ни retry, ни навигация на другой роут не гарантируют восстановление (см. Overview, решение №2), полная перезагрузка — единственный надёжный путь; ссылка на `vite.dev/guide/build.html#load-error-handling`
- [ ] вызвать `registerChunkPreloadRecovery()` один раз на верхнем уровне модуля в `src/app/providers.tsx`, рядом с `initAnalytics()` (единственный оставшийся там side-effect-вызов — `initSentry()` живёт в `sentry-bootstrap.ts`, `reportWebVitals()` удалён); дополнить существующий комментарий над `initAnalytics()`
- [ ] в `providers.test.tsx` добавить `vi.mock('./chunkPreloadRecovery', () => ({ registerChunkPreloadRecovery: vi.fn() }))` и тест «вызывает `registerChunkPreloadRecovery` один раз при импорте модуля» по образцу теста на `initAnalytics`; обновить шапочный комментарий файла
- [ ] написать тест: диспатч `CustomEvent('vite:preloadError', { cancelable: true })` на `window` после вызова `registerChunkPreloadRecovery()` — `event.preventDefault` вызван, `window.location.reload` (замоканный через `vi.stubGlobal`/`vi.spyOn`) вызван ровно один раз
- [ ] написать тест: без диспатча события — `window.location.reload` не вызывается (компонент/модуль сам по себе не триггерит побочный эффект)
- [ ] следить, чтобы слушатель регистрировался в файле один раз (иначе повторная регистрация в jsdom-`window` даст несколько вызовов `reload` на один диспатч); функцию отписки в API не добавлять ради тестов
- [ ] прогнать тесты — должны проходить перед Task 6

### Task 6: Verify acceptance criteria

**Модель:** `opus` · effort `high` — финальная проверка приёмки, высокая цена пропущенной регрессии

- [ ] проверить все три пункта роадмапа 2.6: global boundary в `app/` (уже было, `GlobalErrorBoundary`), per-route boundary через `pages/*`-контент (реализовано на уровне `AppLayout`, не дублируя код по 8 страницам — согласованное отклонение от буквальной формулировки), fallback с retry + ссылкой на главную
- [ ] вручную (`make dev`) проверить: временно бросить ошибку в одной из страниц, убедиться что Header/BottomNav не пропадают, retry и ссылка «На главную» работают
- [ ] прогнать полный набор тестов: `make test`
- [ ] прогнать `make typecheck`, `make lint`, `make format-check`
- [ ] `make knip` — новый экспорт `captureRouteError`/`registerChunkPreloadRecovery` используется, лишних экспортов нет
- [ ] `make build-only && make size` — новый `AppLayout.module.css` и `Link` в entry-чанке не выбивают бюджеты `size-limit`
- [ ] `make coverage` — убедиться, что новые ветки (`onError`, `secondaryAction`, `key={pathname}`-сброс, `captureRouteError`, `registerChunkPreloadRecovery`) покрыты (в проекте нет глобального порога coverage — проверка вручную по отчёту, не автоматический gate)

### Task 7: Обновить документацию и роадмап

**Модель:** `sonnet` · effort `medium` — правки документации по чёткому списку

Area-специфичные решения теперь живут в `.claude/rules/*.md`, а не в `AGENTS.md` (там только
общие для репо конвенции и таблица topic-доков). Каждое правило — одна строка + причина; история —
ссылкой на этот план в `docs/plans/completed/`.

- [ ] `.claude/rules/sentry.md`: заменить строку «`shared/ui/ErrorBoundary` (behind every `AsyncBoundary`) is intentionally untouched» — per-route `ErrorBoundary` в `AppLayout` репортит через `onError={captureRouteError}` (с `componentStack`, потому что перехватывает раньше `GlobalErrorBoundary`); ошибки внутри `AsyncBoundary` в Sentry по-прежнему не идут (принятый gap). Добавить `src/app/layouts/AppLayout.tsx` в `paths:` фронтматтера; добавить этот план в строку «History»
- [ ] `src/app/GlobalErrorBoundary.tsx`: актуализировать WHY-комментарий про «не правка `shared/ui/ErrorBoundary`» — примитив получил опциональный `onError`, но `GlobalErrorBoundary` остаётся на `Sentry.ErrorBoundary` (граница вне роутера, её ошибки репортит сам Sentry)
- [ ] `.claude/rules/build-budgets.md`: уточнить строку «Accepted: navigations run in `startTransition`…» про `<Suspense>` в `AppLayout` по факту теста из Task 4 — `key={pathname}` на границе ремаунтит `Suspense`+страницу при смене `pathname`, так что на `/movie/1 → /movie/2` и `/person/1 → /person/2` старый контент больше не удерживается; добавить строку про `registerChunkPreloadRecovery` (`vite:preloadError` → `reload()`, потому что `React.lazy` кэширует rejected-промис); добавить `src/app/chunkPreloadRecovery.ts` в `paths:`
- [ ] `.claude/rules/data-layer.md`: в пункт про `AsyncBoundary` добавить одну строку — над страничными `AsyncBoundary` стоит per-route граница в `AppLayout`, а сами они `onError` не прокидывают (в Sentry не репортят)
- [ ] `.claude/rules/data-layer.md`, рядом с `AsyncBoundary` (у `ui-patterns.md` в `paths:` нет `ErrorState`): `ErrorState.secondaryAction` — слот, а не `homeLink`/`Link` внутри компонента, потому что `ErrorState` рендерится и вне `<RouterProvider>` (`GlobalErrorBoundary`)
- [ ] `AGENTS.md`: правки только если изменились `paths:` у rule-файлов — синхронизировать колонку «Read when touching» в таблице topic-доков (`sentry.md` + `AppLayout.tsx`, `build-budgets.md` + `chunkPreloadRecovery.ts`). Заметку по существу в `AGENTS.md` не добавлять
- [ ] обновить `plans/roadmap.md`: пункт `### 2.6 Error boundaries` → отметить чекбоксы `[x]`, добавить заголовок `— done, см. docs/plans/20260916-per-route-error-boundaries.md` (по прецеденту 2.3/2.4/2.5.3/2.5.4), зафиксировать отклонение от буквального «в pages/*» в сторону единой точки в `AppLayout`
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

Нет пунктов, требующих действий вне репозитория — вся работа укладывается в код, тесты и
документацию текущего проекта.
