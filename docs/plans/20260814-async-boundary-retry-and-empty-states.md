# Реальный retry для AsyncBoundary + Empty-state для рейлов (roadmap 1.6)

## Overview

Пункт 1.6 `plans/roadmap.md` («Loading / Empty / Error везде») требует:

- `AsyncBoundary` обёрнут вокруг каждой async-секции;
- Skeleton — для контентных страниц, Spinner — для коротких операций;
- **retry-кнопки реально дёргают повторный fetch.**

Аудит кодовой базы показал, что первые два пункта в скоупе Phase 1 уже выполнены: `AsyncBoundary` обёрнут вокруг всех async-секций главной (`HomeDesktop` — 4 рейла), `/search` (`SearchDesktop`/`SearchMobile`) и `/movie/:id` (`MoviePage`), у каждой есть свой Skeleton-fallback (`MovieRailSkeletonDesktop`, `SearchResultSkeletonGrid`/`MobileResultsSkeleton`, `MovieDetailSkeleton`). `HomeMobile` async-логики не имеет вообще — он остаётся на моковом `CATALOG` до фазы 2.5 (см. заметку в 1.1 `plans/roadmap.md`), поэтому вне скоупа этой задачи.

Найдена реальная проблема с третьим пунктом: `ErrorBoundary.reset()` (`src/shared/ui/ErrorBoundary/ErrorBoundary.tsx`) — чисто UI-сброс, он просто перерендеривает `children`, не запуская сеть. Реальный повторный запрос происходит, только если фетчер внутри `children` сам решит идти в сеть. Все фетчеры (`getMovies`, `getSearchMovies`, `getMoviesPage`, `getMovieDetail`, `getMovieImages`) построены на `createCachedFetcher`/собственном `pageCache`, у которых есть `ERROR_CACHE_TTL_MS = 20 000` — cooldown, в течение которого повторный вызов с теми же параметрами отдаёт **тот же самый rejected-промис**, не бья в сеть. Если пользователь нажимает Retry раньше, чем через 20 секунд после ошибки, он видит ту же ошибку снова без единого нового запроса — чекбокс «Retry-кнопки реально дёргают повторный fetch» на практике не выполнен.

Это не гипотетическая проблема: план `docs/plans/completed/20260807-movie-detail-page-api.md` (Task 10) уже документирует обходной путь для теста retry на `MoviePage` — `vi.useFakeTimers()` + `advanceTimersByTime(21_000)`, чтобы дождаться истечения того самого cooldown и получить реальный повторный запрос в тесте. Это подтверждает, что баг реален и уже был замечен, просто не исправлен в проде.

**Также** обнаружено: рейлы на `HomeDesktop` (`MovieRailDesktop`) при пустом результате (`items.length === 0`) не показывают `EmptyState` — просто пустая секция с заголовком и пустой скролл-областью. `/search` (`SearchDesktop`/`SearchMobile`) такой `EmptyState` уже имеет.

**Решение (по итогам обсуждения с пользователем):**

1. У `createCachedFetcher` появляется `invalidate(params)` — точечный сброс кэша (in-memory + sessionStorage-снапшот) для конкретных параметров, без изменения TTL/cooldown в общем случае.
2. `AsyncBoundary` получает опциональный `onRetry?: () => void`, вызываемый **до** `reset()` — конкретное место использования само решает, что инвалидировать, `AsyncBoundary` остаётся generic и не знает про домен `movie`/кэш.
3. Защита от повторных сетевых запросов при двойном клике на Retry (учитываем лимит demo-тарифа — 200 запросов/сутки): `AsyncBoundary` игнорирует повторные клики на retry, пока не поймана НОВАЯ ошибка.
4. Рейлы `HomeDesktop` получают `EmptyState` при пустом результате (только desktop — `HomeMobile` вне скоупа, см. выше).

## Context (from discovery)

- **Файлы/компоненты:** `src/shared/ui/AsyncBoundary/`, `src/shared/ui/ErrorBoundary/`, `src/shared/lib/sessionCache/`, `src/entities/movie/api/{createCachedFetcher,getMovies,getMoviesPage,getSearchMovies,getMovieDetail,getMovieImages}.ts`, `src/entities/movie/hooks/{useTopRatedMovies,useNewMovies,useMovieDetail}.ts`, `src/pages/home/ui/HomeDesktop/HomeDesktop.tsx`, `src/pages/search/model/useMovieCatalog.ts`, `src/pages/search/ui/{SearchDesktop/SearchDesktop.tsx,SearchMobile.tsx}`, `src/pages/movie/MoviePage.tsx`, `src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.tsx`.
- **Паттерны, найденные в коде:** `createCachedFetcher<P, R>` — единый примитив кэширования (TTL 5 мин успех / 20с ошибка / sessionStorage-персист в DEV), уже переиспользуется в 4 местах. `getMoviesPage.ts` держит собственный `pageCache` поверх внутреннего `cachedCursorStep` (тоже `createCachedFetcher`). `useMovieDetail.ts` держит `bundleCache`, который сам «протухает», когда внутренние промисы `getMovieDetail`/`getMovieImages` меняют ссылку (комментарий в файле прямо предвидит этот механизм для будущей инвалидации). `AsyncBoundary` уже расширяли один раз опциональным пропом (`errorFallback`, план 1.5) без breaking change для существующих вызовов — тот же паттерн применяем для `onRetry`.
- **Зависимости:** `SessionCache<T>` (`src/shared/lib/sessionCache/sessionCache.ts`) — `get`/`set`, DEV-guarded; понадобится `remove`. MSW (`msw/node`, `server` из `src/test/setup.ts`) — стандартный способ тестировать реальные/повторные сетевые запросы в этом репо.

## Development Approach

- **Тестовый подход:** Regular — код, затем тесты в той же задаче (устоявшаяся конвенция репозитория).
- Каждая задача выполняется полностью, прежде чем переходить к следующей.
- Каждая задача заканчивается новыми/обновлёнными тестами и зелёным `make test`.
- Обновлять этот файл при отклонении от плана; отмечать выполненное `[x]` сразу.
- React Compiler мемоизирует сам — не добавлять `useMemo`/`useCallback` вручную.

## Testing Strategy

- **Юнит-тесты** обязательны для каждой задачи, где меняется логика (`createCachedFetcher.invalidate`, `sessionCache.remove`, `invalidateMoviesPage`, `AsyncBoundary.onRetry`-гвард, `invalidate*`-компаньоны хуков).
- **Интеграционные тесты** — через MSW, по образцу существующих `getMovies.test.ts`/`getSearchMovies.test.ts`/`SearchDesktop.test.tsx`: ошибка → клик Retry → счётчик MSW-запросов увеличился (не тот же rejected-промис).
- **E2E** — в проекте пока нет Playwright (появится в фазе 2.5 roadmap) — не в рамках этой задачи.

## Progress Tracking

- Отмечать `[x]` сразу по завершении.
- Новые задачи — с префиксом ➕, блокеры — с префиксом ⚠️.
- По завершении — перенести этот файл в `docs/plans/completed/`.

## Solution Overview

- `createCachedFetcher` возвращает не голую функцию, а функцию с довешенными `invalidate(params)`/`clear()` (`Object.assign`). `invalidate` удаляет запись из in-memory `Map` и из sessionStorage-снапшота (новый метод `SessionCache.remove`) — без этого точечная инвалидация неполна: `createCachedFetcher` при промахе in-memory кэша проверяет sessionStorage и, если снапшот там ещё «свежий» (в пределах `ERROR_CACHE_TTL_MS`), реплеит его вместо реального похода в сеть.
- `getMoviesPage.ts` (курсорная эмуляция numbered-page) получает `invalidateMoviesPage(params, page)`: чистит свою запись `pageCache` для `{params, page}` + инвалидирует первый шаг курсора (`cachedCursorStep.invalidate({ params, cursor: undefined })`). Первый шаг детерминирован (не зависит от целевой страницы) и покрывает доминирующий сценарий отказа — 403 квоты демо-тарифа рвёт все шаги одинаково. Известное принятое ограничение: если сбой был именно на промежуточном шаге (>1) при живом первом шаге, тот шаг всё ещё ждёт `ERROR_CACHE_TTL_MS` — редкий случай (нужен frame независимо упавший intermediate-запрос), не стоит усложнения ради него.
- `AsyncBoundary` получает `onRetry?: () => void`. Реальный `reset` из `ErrorBoundary` оборачивается: клик на Retry → `onRetry?.()` (инвалидация конкретного кэш-ключа конкретным местом использования) → `reset()` (снимает `hasError`, дети перерендериваются, `use()` внутри вызывает фетчер заново — уже без кэш-хита). Гвард на дабл-клик — `useRef`-флаг, сравнивающий `error`-ссылку между рендерами `errorFallback`: новая ошибка = новый цикл = гвард снят.
- Три конкретных места подключают `onRetry` каждое своим способом:
  - **Home rails** (`getMovies`) — companion-экспорты `invalidateTopRatedMovies(params?)`/`invalidateNewMovies(params?)` рядом с `useTopRatedMovies`/`useNewMovies`, построенные из ТОЙ ЖЕ pure-функции параметров, что и сам хук (никакого дублирования формы параметров).
  - **Search** (`getSearchMovies`/`getMoviesPage` через `useMovieCatalog`) — `invalidateMovieCatalog(params)` в page-слое `src/pages/search/model/useMovieCatalog.ts`, та же ветка `query.trim()`, что и в самом хуке чтения.
  - **MoviePage** (`getMovieDetail`+`getMovieImages` через `useMovieDetail`) — `invalidateMovieDetail(id)` рядом с хуком, инвалидирует обе части bundle; `bundleCache` в `useMovieDetail.ts` сам пересоберётся, как и предполагает существующий комментарий в файле.
- `MovieRailDesktop` рендерит `EmptyState` вместо пустой скролл-области, когда `items.length === 0`, сохраняя заголовок секции видимым (тот же паттерн, что уже применён в `SearchResults`).

## Technical Details

**`createCachedFetcher.ts` — новый тип возвращаемого значения:**

```ts
type CachedFetcher<P, R> = ((params: P) => Promise<R>) & {
  invalidate: (params: P) => void
  clear: () => void
}

export const createCachedFetcher = <P, R = Movie[]>(
  namespace: string,
  fetcher: (params: P) => Promise<R>,
): CachedFetcher<P, R> => {
  // ...существующий cache/sessionCache...
  const fetcherFn = (params: P): Promise<R> => { /* без изменений */ }

  return Object.assign(fetcherFn, {
    invalidate: (params: P) => {
      const key = JSON.stringify(params)
      cache.delete(key)
      sessionCache.remove(key)
    },
    clear: () => cache.clear(),
  })
}
```

**`sessionCache.ts` — новый метод:**

```ts
export type SessionCache<T> = {
  get: (key: string) => SessionCacheEntry<T> | undefined
  set: (key: string, entry: SessionCacheEntry<T>) => void
  remove: (key: string) => void
}
// remove: DEV-guard + try/catch, как у set — sessionStorage.removeItem(storageKey(key))
```

**`getMoviesPage.ts` — точечная инвалидация:**

```ts
export const invalidateMoviesPage = (params: CatalogParams, page: number): void => {
  pageCache.delete(JSON.stringify({ params, page }))
  cachedCursorStep.invalidate({ params, cursor: undefined })
}
```

**`AsyncBoundary.tsx` — `onRetry` + гвард:**

```tsx
type Props = {
  children: ReactNode
  fallback?: ReactNode
  errorFallback?: (params: ErrorFallbackParams) => ReactNode
  onRetry?: () => void
}

export function AsyncBoundary({ children, fallback = <Spinner />, errorFallback = defaultErrorFallback, onRetry }: Props) {
  const isRetryingRef = useRef(false)
  const lastErrorRef = useRef<Error | null>(null)

  const wrappedFallback = ({ error, reset }: ErrorFallbackParams) => {
    if (error !== lastErrorRef.current) {
      lastErrorRef.current = error
      isRetryingRef.current = false
    }

    const guardedReset = () => {
      if (isRetryingRef.current) return
      isRetryingRef.current = true
      onRetry?.()
      reset()
    }

    return errorFallback({ error, reset: guardedReset })
  }

  return (
    <ErrorBoundary fallback={wrappedFallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}
```

**`useTopRatedMovies.ts` (аналогично `useNewMovies.ts`):**

```ts
const buildTopRatedParams = (params?: { type: MovieType[] }) => ({
  sortField: ['rating.kp'],
  'rating.kp': ['7-10'],
  sortType: ['-1'],
  type: params?.type,
})

export const useTopRatedMovies = (params?: { type: MovieType[] }) =>
  use(getMovies(buildTopRatedParams(params)))

export const invalidateTopRatedMovies = (params?: { type: MovieType[] }) =>
  getMovies.invalidate(buildTopRatedParams(params))
```

**`useMovieDetail.ts` — инвалидация bundle:**

```ts
export const invalidateMovieDetail = (id: number): void => {
  getMovieDetail.invalidate(id)
  getMovieImages.invalidate(id)
}
```

## What Goes Where

- **Implementation Steps** (`[ ]`): весь код ниже — в рамках репозитория.
- **Post-Completion**: ручная проверка в браузере (DevTools offline/403-эмуляция, визуальная проверка EmptyState и Retry).

## Implementation Steps

### Task 1: `invalidate`/`clear` в `createCachedFetcher` + `SessionCache.remove`

**Files:**

- Modify: `src/shared/lib/sessionCache/sessionCache.ts`
- Modify: `src/shared/lib/sessionCache/sessionCache.test.ts`
- Modify: `src/entities/movie/api/createCachedFetcher.ts`
- Modify: `src/entities/movie/api/createCachedFetcher.test.ts`

- [x] добавить `remove(key: string): void` в тип `SessionCache<T>` и в `createSessionCache` — DEV-guard (`import.meta.env.DEV`) и try/catch, как у `set`
- [x] написать тест: `remove` удаляет ключ (повторный `get` → `undefined`), не бросает вне DEV, не бросает на несуществующем ключе
- [x] в `createCachedFetcher.ts` вернуть `Object.assign(fetcherFn, { invalidate, clear })` вместо голой функции; тип `CachedFetcher<P, R>` по образцу из Technical Details
- [x] `invalidate(params)` — `cache.delete(key)` + `sessionCache.remove(key)` (тот же `key = JSON.stringify(params)`, что в основном пути чтения)
- [x] `clear()` — `cache.clear()`
- [x] написать тест: `invalidate(params)` заставляет следующий вызов реально ударить в fetcher, даже если предыдущий rejected-промис ещё «свежий» по `ERROR_CACHE_TTL_MS`
- [x] написать тест: `invalidate` на несуществующих params — no-op, не бросает
- [x] написать тест: `clear()` сбрасывает весь namespace (несколько разных params) за один вызов
- [x] запустить тесты — должны пройти перед задачей 2

### Task 2: `invalidateMoviesPage` для курсорной пагинации

**Files:**

- Modify: `src/entities/movie/api/getMoviesPage.ts`
- Modify: `src/entities/movie/api/getMoviesPage.test.ts`

- [x] экспортировать `invalidateMoviesPage(params: CatalogParams, page: number): void` по образцу из Technical Details
- [x] задокументировать комментарием принятое ограничение: инвалидируется только первый шаг курсора (детерминирован, не зависит от page) — доминирующий сценарий отказа (403 квоты) рвёт все шаги одинаково; сбой именно на промежуточном шаге при живом первом — редкий случай, ждёт `ERROR_CACHE_TTL_MS`
- [x] написать тест: rejected `getMoviesPage` → `invalidateMoviesPage` → повторный `getMoviesPage` с теми же параметрами делает новый сетевой запрос (MSW call-counter), а не повторяет тот же rejected-промис
- [x] написать тест: `invalidateMoviesPage` не задевает независимые записи `pageCache` для других страниц/параметров
- [x] запустить тесты — должны пройти перед задачей 3

### Task 3: `onRetry` + защита от дабл-клика в `AsyncBoundary`

**Files:**

- Modify: `src/shared/ui/AsyncBoundary/AsyncBoundary.tsx`
- Modify: `src/shared/ui/AsyncBoundary/AsyncBoundary.test.tsx`

- [ ] добавить опциональный проп `onRetry?: () => void`
- [ ] обернуть `reset`, передаваемый в `errorFallback`: `onRetry?.()` вызывается ДО реального `reset()`
- [ ] гвард на повторные клики — `useRef`-флаг, снимается только когда `ErrorBoundary` ловит НОВУЮ ошибку (сравнение `error`-ссылки на каждый рендер `errorFallback`, по образцу из Technical Details)
- [ ] существующие вызовы `AsyncBoundary` без `onRetry` — поведение не меняется (проп опционален, дефолт `undefined`)
- [ ] написать тест: `onRetry` вызывается один раз перед `reset`
- [ ] написать тест: два быстрых клика подряд на retry вызывают `onRetry`/`reset` только один раз
- [ ] написать тест: после того как повторная попытка тоже упала с НОВОЙ ошибкой, retry снова рабочий (гвард переармирован)
- [ ] запустить тесты — должны пройти перед задачей 4

### Task 4: Реальный retry для рейлов `HomeDesktop`

**Files:**

- Modify: `src/entities/movie/hooks/useTopRatedMovies.ts`
- Modify: `src/entities/movie/hooks/useNewMovies.ts`
- Modify: `src/entities/movie/hooks/useTopRatedMovies.test.ts` (или создать, если теста ещё нет)
- Modify: `src/entities/movie/hooks/useNewMovies.test.ts` (или создать, если теста ещё нет)
- Modify: `src/pages/home/ui/HomeDesktop/HomeDesktop.tsx`
- Create: `src/pages/home/ui/HomeDesktop/HomeDesktop.test.tsx`

- [ ] `useTopRatedMovies.ts`: вынести параметры в `buildTopRatedParams(params?)`, использовать в хуке и в новом экспорте `invalidateTopRatedMovies(params?)` (по образцу из Technical Details)
- [ ] `useNewMovies.ts`: аналогично — `buildNewMoviesParams(params?)` + `invalidateNewMovies(params?)`
- [ ] экспортировать `invalidateTopRatedMovies`/`invalidateNewMovies` из `hooks/index.ts` (попадут в `@entities/movie` через существующий `export * from './hooks'`)
- [ ] `HomeDesktop.tsx`: добавить `onRetry` на все 4 `AsyncBoundary`, с параметрами СОВПАДАЮЩИМИ с параметрами внутри соответствующего рейл-компонента: `PopularMoviesRail`/`PersonalRails` → `invalidateTopRatedMovies()`, `TopAnimeRails` → `invalidateTopRatedMovies({ type: ['anime'] })`, `TrandingSeriesRail` → `invalidateNewMovies({ type: ['tv-series'] })`
- [ ] написать/дополнить тесты `invalidateTopRatedMovies`/`invalidateNewMovies` (MSW): после ошибки и вызова invalidate следующий `getMovies(...)`-вызов реально идёт в сеть
- [ ] написать `HomeDesktop.test.tsx`: рейл с мокнутой 500-ошибкой → `ErrorState` с Retry → клик → новый MSW-запрос → рейл рендерит данные
- [ ] запустить тесты — должны пройти перед задачей 5

### Task 5: Реальный retry для `/search`

**Files:**

- Modify: `src/pages/search/model/useMovieCatalog.ts`
- Modify: `src/pages/search/model/useMovieCatalog.test.tsx`
- Modify: `src/pages/search/ui/SearchDesktop/SearchDesktop.tsx`
- Modify: `src/pages/search/ui/SearchMobile.tsx`
- Modify: `src/pages/search/ui/SearchDesktop/SearchDesktop.test.tsx`
- Modify: `src/pages/search/ui/SearchMobile.test.tsx`

- [ ] экспортировать `invalidateMovieCatalog({ query, filters, sort, page }: MovieCatalogParams): void` из `useMovieCatalog.ts` — та же ветка `trimmedQuery ? ... : ...`, что в самом хуке чтения: search-режим → `getSearchMovies.invalidate({ query: trimmedQuery, page })`, catalog-режим → `invalidateMoviesPage(filtersToParams(filters, sort), page)` (из Task 2)
- [ ] `SearchDesktop.tsx`: `<AsyncBoundary onRetry={() => invalidateMovieCatalog({ query: deferredQuery, filters: deferredFilters, sort: deferredSort, page: deferredPage })} ...>`
- [ ] `SearchMobile.tsx`: то же на его `AsyncBoundary`
- [ ] написать тест на `invalidateMovieCatalog`: search-режим (непустой query) бьёт `getSearchMovies.invalidate`, catalog-режим (пустой query) бьёт `invalidateMoviesPage`
- [ ] дополнить `SearchDesktop.test.tsx`/`SearchMobile.test.tsx` сценарием: ошибка → Retry → реальный повторный запрос (MSW call-counter), а не тот же rejected-промис
- [ ] запустить тесты — должны пройти перед задачей 6

### Task 6: Реальный retry для `/movie/:id`

**Files:**

- Modify: `src/entities/movie/hooks/useMovieDetail.ts`
- Modify: `src/entities/movie/hooks/useMovieDetail.test.tsx`
- Modify: `src/pages/movie/MoviePage.tsx`
- Modify: `src/pages/movie/MoviePage.test.tsx`

- [ ] экспортировать `invalidateMovieDetail(id: number): void` из `useMovieDetail.ts` (по образцу из Technical Details) — `bundleCache` пересоберётся сам, когда внутренние промисы `getMovieDetail`/`getMovieImages` сменят ссылку (существующий комментарий в файле уже предполагает этот механизм)
- [ ] экспортировать `invalidateMovieDetail` из `hooks/index.ts` → `@entities/movie`
- [ ] `MoviePage.tsx`: `<AsyncBoundary errorFallback={movieErrorFallback} fallback={<MovieDetailSkeleton />} onRetry={() => invalidateMovieDetail(numericId)}>`
- [ ] обновить существующий 404-retry тест в `MoviePage.test.tsx` (план 1.5, Task 10) — убрать обход через `vi.useFakeTimers()` + `advanceTimersByTime(21_000)`, retry теперь реально бьёт в сеть без ожидания cooldown
- [ ] написать тест: обычная (не 404) ошибка → Retry → реальный повторный запрос без ожидания 20с
- [ ] запустить тесты — должны пройти перед задачей 7

### Task 7: `EmptyState` для рейлов `HomeDesktop`

**Files:**

- Modify: `src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.tsx`
- Create: `src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.test.tsx`

- [ ] при `items.length === 0` рендерить `EmptyState` (заголовок + подзаголовок «В подборке пока пусто» / аналог, echo `title` рейла) вместо пустой `hide-scrollbar`-области; заголовок секции (`s.header`, ссылка на `/search`) остаётся видимым
- [ ] написать тест: `items=[]` → рендерится `EmptyState`, карточки отсутствуют
- [ ] написать тест: `items` непустой → рендерятся карточки, `EmptyState` отсутствует
- [ ] запустить тесты — должны пройти перед задачей 8

### Task 8: Проверка acceptance criteria

- [ ] проверить, что все 4 пункта 1.6 `plans/roadmap.md` выполнены: `AsyncBoundary` обёрнут вокруг каждой async-секции (подтверждено аудитом — уже было так), Skeleton/Spinner на местах, retry реально бьёт в сеть (Task 3–6), EmptyState на рейлах (Task 7)
- [ ] проверить edge cases: двойной клик на Retry не даёт двух сетевых запросов (Task 3); Retry на `/movie/:id` после НОВОЙ ошибки снова рабочий; `invalidateMoviesPage`/`invalidateMovieCatalog` не ломают независимые кэш-записи других страниц/фильтров
- [ ] запустить полный набор тестов: `make test`
- [ ] запустить `make lint && make typecheck && make build`
- [ ] проверить покрытие тестами новых веток соответствует уровню остального `entities/movie/api` (см. профиль в `docs/plans/completed/20260807-movie-detail-page-api.md`, Task 11)

### Task 9: Обновление документации

- [ ] отметить выполненные пункты 1.6 в `plans/roadmap.md`
- [ ] в `AGENTS.md` — если раздел «Data state» или паттерн `AsyncBoundary`/`createCachedFetcher` упоминает старое поведение retry, обновить формулировку (retry теперь реально инвалидирует кэш, а не просто ждёт cooldown)

## Post-Completion

**Ручная проверка** (после Task 9):

- в браузере: DevTools → throttle/block запрос к API (или дождаться реального 403 квоты) → на главной странице у одного из рейлов появляется `ErrorState` с Retry → клик → в Network-панели виден новый запрос (не мгновенный ответ из кэша) → рейл рендерит данные
- то же для `/search` (с активным query и с активными фильтрами — оба режима) и `/movie/:id` (обычная ошибка и 404)
- рейл с заведомо пустым результатом (искусственно сузить фильтр/квоту так, чтобы API вернул `docs: []`) → видно `EmptyState`, а не пустая полоса
