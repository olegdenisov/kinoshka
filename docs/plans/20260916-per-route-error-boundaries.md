# Per-route Error Boundaries (роадмап 2.6)

## Overview

Роадмап-пункт 2.6 «Error boundaries» на данный момент не выполнен: у приложения есть только один,
глобальный `ErrorBoundary` (точнее — `GlobalErrorBoundary`, `Sentry.ErrorBoundary` вокруг всего
`<RouterProvider>` в `providers.tsx`, добавлен позже, в рамках 2.5.1). Проблема — граница одна на
всё дерево: если упадёт компонент внутри конкретной страницы (`/movie/:id`, `/search` и т.д.),
пользователь теряет вообще всё — `Header`/`MobileHeader`+`BottomNav` размонтируются вместе со
страницей, а не только контент страницы.

Цель — дать каждому роуту собственную границу ошибки, не теряя chrome (Header/BottomNav) при
падении конкретной страницы, без дублирования кода по 6 page-слайсам и без потери Sentry-репортинга
для таких ошибок.

**Ключевое архитектурное решение (согласовано с пользователем):**

- Одна точка границы — `AppLayout.tsx`, вокруг `<Outlet/>` (тот же принцип «одна точка, через
  которую проходят все роуты», что уже используется в этом файле для `<Suspense>`/`trackPageview`).
  Никакой новой границы в каждом из 6 `pages/*` — это было бы дублированием одной и той же
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
  сразу). `/search` не задет — там меняется только query, `pathname` стабилен, `key` не меняется,
  stale-content-паттерн `useCatalogUpdateStatus` продолжает работать как раньше. Альтернатива без
  ремаунта (сброс `hasError` через `resetKey`-проп в `getDerivedStateFromProps`, без размонтирования
  детей) сознательно не выбрана — усложняет `shared/ui/ErrorBoundary` ради частного случая, а
  наблюдаемая деградация UX ограничена одним роутом с динамическим сегментом.

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
  из `react-router` — это остаётся так и после плана (см. решение №1 выше).
- `src/shared/ui/AsyncBoundary/AsyncBoundary.tsx` — уже комбинирует `ErrorBoundary` + `Suspense` +
  `ErrorState` для async-секций внутри страниц; новая граница в `AppLayout` — та же композиция
  (`ErrorBoundary` снаружи `Suspense`), но на уровень выше, вокруг `<Outlet/>`, а не внутри страницы.
- `src/app/GlobalErrorBoundary.tsx` — `Sentry.ErrorBoundary`, оборачивает `<RouterProvider>` в
  `providers.tsx`. Остаётся без изменений — последняя линия защиты для ошибок вне `<Outlet/>`
  (например, в самом `AppLayout`: выбор chrome, `useViewport`, и т.п.).
- `src/app/layouts/AppLayout.tsx` — единая точка для всех роутов; сейчас держит только
  `<Suspense fallback={<Spinner/>}><Outlet/></Suspense>` (code-splitting, роадмап 2.5.3); нет
  собственного CSS-модуля (стили полностью в дочерних виджетах) — план добавляет первый, только
  под стиль ссылки «На главную».
- `src/app/sentry.ts` — уже содержит тестируемые чистые функции (`scrubApiKeyHeader`, `initSentry`);
  сюда логично добавить `captureRouteError`, по прецеденту.
- `src/app/providers.tsx` — вызывает `initSentry()`/`initAnalytics()`/`reportWebVitals()` один раз
  на верхнем уровне модуля, до объявления `Providers`; сюда же по тому же прецеденту добавляется
  `registerChunkPreloadRecovery()` (Task 5).
- `src/main.tsx` — минимальный bootstrap, не тестируется отдельно; слушатель `vite:preloadError`
  сознательно НЕ здесь, а в `providers.tsx`, где уже есть паттерн тестируемых side-effect-вызовов
  на импорте модуля.
- `src/app/layouts/AppLayout.test.tsx` — тестирует композицию chrome + `<Outlet/>` через
  `MemoryRouter`/`createMemoryRouter`+`RouterProvider`; для проверки сброса границы при навигации
  нужен `createMemoryRouter`, как в последнем существующем describe-блоке файла.

## Development Approach

- **Тестирование**: Regular (код → тесты, в рамках той же задачи).
- Каждая задача — маленькая, самодостаточная, тесты пишутся сразу после кода в той же задаче.
- Все тесты проходят перед переходом к следующей задаче.

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
(`src/app/providers.tsx`, вызывается один раз на верхнем уровне модуля, по прецеденту `initSentry`/
`initAnalytics`): слушает `window`'s `vite:preloadError`, делает `event.preventDefault()` +
`window.location.reload()`. Это событие Vite диспатчит ДО того, как та же ошибка дойдёт как
rejected promise до `Suspense`/`ErrorBoundary` — так что для настоящих chunk-load-сбоев страница в
большинстве случаев успевает перезагрузиться раньше, чем пользователь увидит `ErrorState`-фолбэк
вообще; `ErrorState`'s retry/«На главную» остаются на случай, если слушатель почему-то не
сработал, или ошибка — не chunk-load, а обычная рантайм/данных-ошибка компонента.

**Что НЕ покрывается этим планом (принятые ограничения):**

- Ошибки, пойманные страничными `AsyncBoundary` (rails на главной, `/search`, `/movie/:id` —
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
  `componentDidCatch` после существующего `console.error`. Необязательный — не ломает три текущих
  места использования (`AsyncBoundary`, а через него — все `AsyncBoundary`-точки на Home/`/search`/
  `/movie/:id`), которые его не передают.
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
- `registerChunkPreloadRecovery(): void` в `src/app/providers.tsx` (или соседний модуль, см. Task 5) —
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

**Files:**

- Modify: `src/app/sentry.ts`
- Modify: `src/app/sentry.test.ts`

- [ ] добавить экспорт `captureRouteError(error: Error, errorInfo: ErrorInfo): void`, вызывающий `Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } }, mechanism: { handled: true } })`
- [ ] короткий WHY-комментарий: перехватывается раньше `GlobalErrorBoundary`, поэтому репортинг явный; `errorInfo`/`componentStack` — чтобы не потерять то, что раньше давал `Sentry.ErrorBoundary`/`captureReactException`
- [ ] расширить мок `vi.mock('@sentry/react', ...)` в `sentry.test.ts` — добавить `captureException: vi.fn()`
- [ ] написать тест: `captureRouteError(error, errorInfo)` вызывает `Sentry.captureException` ровно один раз с этим `error` и с `contexts.react.componentStack === errorInfo.componentStack`
- [ ] прогнать тесты — должны проходить перед Task 3

### Task 3: `secondaryAction`-слот в `shared/ui/ErrorState`

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

**Files:**

- Create: `src/app/layouts/AppLayout.module.css`
- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `src/app/layouts/AppLayout.test.tsx`

- [ ] импортировать `ErrorBoundary`, `ErrorState` из `@shared/ui`, `captureRouteError` из `../sentry`, `Link` из `react-router` (уже используется в файле лишь транзитивно через хуки — прямой импорт `Link`-компонента новый), стили — `import s from './AppLayout.module.css'`
- [ ] создать `AppLayout.module.css` с `.homeLink` (тот же паттерн токенов, что у `.retryButton` в `ErrorState.module.css`: `var(--text-secondary)`, `var(--border-soft)`, `var(--bg-hover)` на hover, без retry-акцентного фона)
- [ ] определить локальную `routeErrorFallback = ({ error, reset }) => <ErrorState title='Something went wrong' description={error?.message || 'Please try again later'} onRetry={reset} secondaryAction={<Link className={s.homeLink} to='/'>На главную</Link>} />`
- [ ] обернуть `<Suspense><Outlet/></Suspense>` в `<ErrorBoundary key={pathname} fallback={routeErrorFallback} onError={captureRouteError}>` (граница снаружи Suspense — тот же порядок, что в `AsyncBoundary`, чтобы ловить и ошибки загрузки чанка, и runtime-ошибки страницы; про ремаунт `Suspense`/страницы на `key={pathname}` см. Overview/Solution Overview)
- [ ] написать тест: страница, бросающая ошибку при рендере — chrome (`Header` на десктопе / `MobileHeader`+`BottomNav` на мобильном) остаётся в дереве, вместо контента страницы — `ErrorState` с текстом ошибки и ссылкой «На главную». Компонент-бомба — с module-level `shouldThrow`-флагом (см. Task 1, не self-flipping внутри рендера)
- [ ] написать тест: клик на «Попробовать снова» в fallback восстанавливает страницу, если причина ошибки устранена (аналог теста `GlobalErrorBoundary.test.tsx`, но здесь — с сохранением chrome вокруг)
- [ ] написать тест: `captureRouteError` (замоканный) вызывается при падении страницы — проверка через `vi.mock('../sentry', ...)`, аналогично мокингу `trackPageview` в этом же файле
- [ ] написать тест: ошибка внутри дочернего `AsyncBoundary` (т.е. страница сама оборачивает падающий кусок в свой `AsyncBoundary`, как `MoviePage`/`Search`/rails) перехватывается ИМ, не новой границей — рендерится страничный фолбэк `AsyncBoundary`, chrome и структура страницы вокруг него целы, `captureRouteError` не вызван (страничные `AsyncBoundary` не прокидывают `onError` — см. принятый gap в Solution Overview)
- [ ] написать тест: навигация с упавшего роута на другой (через `createMemoryRouter`+`RouterProvider`, как в последнем describe-блоке файла) — граница сбрасывается сама (новый роут рендерится нормально, без нужды в retry) благодаря `key={pathname}`
- [ ] написать тест: навигация между двумя роутами с одинаковым layout, но разным `pathname` (например `/movie/1` → `/movie/2`, если фикстура роутов в файле это позволяет) — подтвердить фактическое поведение ремаунта `Suspense`/страницы, задокументированное как принятое следствие в Overview (не регрессия, а зафиксированный факт)
- [ ] прогнать тесты — должны проходить перед Task 5

### Task 5: `registerChunkPreloadRecovery` — авто-перезагрузка при сбое загрузки чанка

**Files:**

- Create: `src/app/chunkPreloadRecovery.ts`
- Create: `src/app/chunkPreloadRecovery.test.ts`
- Modify: `src/app/providers.tsx`

- [ ] реализовать `registerChunkPreloadRecovery(): void` — `window.addEventListener('vite:preloadError', event => { event.preventDefault(); window.location.reload() })`
- [ ] WHY-комментарий: Vite диспатчит это событие при сбое динамического `import()` чанка (устаревший деплой/chunk 404/сетевая ошибка) ДО того, как та же ошибка дойдёт до `Suspense`/`ErrorBoundary`; `React.lazy` кэширует rejected-промис на модуль — ни retry, ни навигация на другой роут не гарантируют восстановление (см. Overview, решение №2), полная перезагрузка — единственный надёжный путь; ссылка на `vite.dev/guide/build.html#load-error-handling`
- [ ] вызвать `registerChunkPreloadRecovery()` один раз на верхнем уровне модуля в `src/app/providers.tsx`, рядом с `initSentry()`/`initAnalytics()`/`reportWebVitals()`
- [ ] написать тест: диспатч `CustomEvent('vite:preloadError', { cancelable: true })` на `window` после вызова `registerChunkPreloadRecovery()` — `event.preventDefault` вызван, `window.location.reload` (замоканный через `vi.stubGlobal`/`vi.spyOn`) вызван ровно один раз
- [ ] написать тест: без диспатча события — `window.location.reload` не вызывается (компонент/модуль сам по себе не триггерит побочный эффект)
- [ ] прогнать тесты — должны проходить перед Task 6

### Task 6: Verify acceptance criteria

- [ ] проверить все три пункта роадмапа 2.6: global boundary в `app/` (уже было, `GlobalErrorBoundary`), per-route boundary через `pages/*`-контент (реализовано на уровне `AppLayout`, не дублируя код по 6 страницам — согласованное отклонение от буквальной формулировки), fallback с retry + ссылкой на главную
- [ ] вручную (`make dev`) проверить: временно бросить ошибку в одной из страниц, убедиться что Header/BottomNav не пропадают, retry и ссылка «На главную» работают
- [ ] прогнать полный набор тестов: `make test`
- [ ] прогнать `make typecheck` и `make lint`
- [ ] `make coverage` — убедиться, что новые ветки (`onError`, `secondaryAction`, `key={pathname}`-сброс, `captureRouteError`, `registerChunkPreloadRecovery`) покрыты (в проекте нет глобального порога coverage — проверка вручную по отчёту, не автоматический gate)

### Task 7: Обновить документацию и роадмап

- [ ] обновить `AGENTS.md`: добавить короткую заметку в раздел про `AsyncBoundary`/error-состояния — упомянуть per-route `ErrorBoundary` в `AppLayout`, `onError`→Sentry (с `componentStack`), `secondaryAction`-слот в `ErrorState` (и почему не `homeLink`/`Link` внутри самого компонента), `registerChunkPreloadRecovery`/`vite:preloadError`, почему граница на уровне layout, а не в каждой странице; принятые ограничения (ошибки внутри `AsyncBoundary` в Sentry не идут, `key={pathname}` ремаунтит страницу при смене pathname — включая `/movie/:id`)
- [ ] проверить и, если нужно, уточнить существующий абзац в разделе «Performance budgets» AGENTS.md про «Accepted risk» `<Suspense>` в `AppLayout` (react-router `startTransition`, отложенный коммит дерева) — по факту теста из Task 4 (навигация `/movie/1 → /movie/2`), не разошлось ли поведение с тем, что там описано, после появления `key={pathname}`
- [ ] обновить `plans/roadmap.md`: пункт `### 2.6 Error boundaries` → отметить чекбоксы `[x]`, добавить заголовок `— done, см. docs/plans/20260916-per-route-error-boundaries.md` (по прецеденту 2.3/2.4/2.5.3/2.5.4), зафиксировать отклонение от буквального «в pages/*» в сторону единой точки в `AppLayout`
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

Нет пунктов, требующих действий вне репозитория — вся работа укладывается в код, тесты и
документацию текущего проекта.
