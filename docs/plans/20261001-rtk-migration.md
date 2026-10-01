# Миграция ветки `rtk` на Redux Toolkit (roadmap 3.1)

## Overview

- Ветка `rtk` повторяет фичи Phase 1+2, но весь стейт идёт через Redux Toolkit: клиентский — `createSlice` + persist через listener middleware, серверный — RTK Query.
- Цель — честная база для сравнительной таблицы roadmap 3.8 (DX, бойлерплейт, размер бандла), поэтому в ветке не остаётся второго механизма кеша/стейта: `createCachedFetcher`, `sessionCache`, `use()` + `AsyncBoundary`, `useStorageSlot` уходят.
- Поведение для пользователя не меняется: те же страницы, те же ключи `localStorage` (`kinoshka:*`), e2e-спеки проходят без правок сценариев.
- Ветка живёт параллельно `main` и в `main` не мержится (roadmap, Фаза 3).

Покрываемые пункты roadmap 3.1:

- Favorites в `createSlice` с persist
- Theme в `createSlice` с persist
- RTK Query mutation `toggleFavorite` (optimistic update)
- Server-side pagination в endpoint каталога
- Tag-based invalidation для recommendations
- README ветки: разбор паттернов RTK

## Context (from discovery)

- Исходное состояние: `rtk` == `main`, `@reduxjs/toolkit`/`react-redux` не установлены.
- Клиентский стейт — 5 слотов `createStorageSlot` + `useStorageSlot`: `src/features/{favorites,theme,watched,watchlist,profile}/model/*`. `set()` возвращает `boolean`, `subscribe` слушает `storage`-событие (синхронизация между вкладками).
- Тему до гидрации читает инлайн-скрипт в `index.html` из `kinoshka:theme` — формат ключа менять нельзя (иначе правка скрипта и CSP-хэша, см. `.claude/rules/csp.md`).
- Async — фетчеры на `createCachedFetcher` в `src/entities/movie/api/*`, `src/entities/person/api/*`; чтение через `use()` в `src/entities/*/hooks/*`, `src/features/{favorites,watched,watchlist}/model/use*Movies.ts`, `src/pages/search/model/useMovieCatalog.ts`, `src/pages/recommendations/model/useRecommendedMovies.ts`; Retry — через `invalidate*` + `AsyncBoundary.onRetry`.
- Пагинация каталога — обход курсора `next` 1..N в `src/entities/movie/api/getMoviesPage.ts` (двухуровневый кеш); текстовый поиск `getSearchMovies` — настоящий `page`.
- Справочники жанров/стран — `createDictionaryCache`: `localStorage`-кеш на 7 дней, фоновое обновление, кулдаун 60 с.
- Тесты: 122 файла, MSW с `onUnhandledRequest: 'error'`, глобальный сброс кешей в `src/test/setup.ts`.
- Бюджеты: `size-limit` в `package.json` (`vendor` 184.7 KB gzip, `shared` 22.6 KB).
- Лимит demo-API — 200 запросов/день: e2e гоняем один раз в конце.

## Development Approach

- **testing approach**: Regular (код, затем тесты в той же задаче)
- каждую задачу доводим до конца, прежде чем брать следующую; изменения маленькие и сфокусированные
- **CRITICAL: каждая задача включает новые/обновлённые тесты** на код этой задачи (успех + ошибки)
- **CRITICAL: все тесты зелёные перед следующей задачей** — `make test`, `make typecheck`, `make lint`
- **CRITICAL: при изменении объёма работ обновлять этот файл**
- публичные сигнатуры хуков клиентского стейта (`useFavorites`, `useTheme`, `useWatched`, `useWatchlist`, `useProfile`) сохраняются — потребители не трогаем
- хуки серверных данных меняют контракт: вместо значения возвращают результат RTK Query (`data`/`isLoading`/`isFetching`/`error`/`refetch`)
- в промежуточных задачах старый и новый data-layer сосуществуют; каждая задача удаляет старый фетчер своих endpoints, остатки добивает Task 14
- конвенции проекта: `type` вместо `interface`, без ручных `useMemo`/`useCallback`, WHY-комментарии на русском, импорты только через barrel `index.ts`

## Testing Strategy

- **unit**: редьюсеры/селекторы slices — чистыми тестами; persist и хуки — через свежий `makeStore()` на тест; endpoints — через `makeStore()` + MSW (`dispatch(endpoint.initiate(...))`), хуки и страницы — через `renderWithStore`
- изоляция тестов: стор создаётся заново на каждый тест, поэтому глобальный сброс кеша RTK Query не нужен; `localStorage.clear()` в `setup.ts` остаётся
- **e2e** (`e2e/*.spec.ts`): сценарии не меняются — это критерий паритета поведения. Запускаются один раз в Task 16 (квота API)

## Progress Tracking

- выполненные пункты сразу помечать `[x]`
- новые задачи — с префиксом ➕, блокеры — с ⚠️
- при отклонении от плана обновлять план

## Solution Overview

**Раскладка по FSD**

| Что                                                                      | Где                                                                       | Почему                                                                                                            |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `baseApi` (`createApi` с пустыми endpoints, `fakeBaseQuery`, `tagTypes`) | `src/shared/api/baseApi.ts`                                               | endpoints инжектят и `entities`, и `features`, и `pages` — общая точка только в `shared`                          |
| `QueryError`, `toQueryError`                                             | `src/shared/api/queryError.ts`                                            | ошибка в сторе должна быть сериализуемой: `{ status?: number; message: string }` вместо экземпляра `ApiError`     |
| listener middleware, `persistSlice`                                      | `src/shared/lib/store/`                                                   | инфраструктура без доменной логики                                                                                |
| slices                                                                   | `src/features/<feature>/model/<feature>Slice.ts`                          | доменная логика остаётся в фиче; `app` только собирает редьюсеры                                                  |
| endpoints фильмов/персон                                                 | `src/entities/{movie,person}/api/*Api.ts` через `baseApi.injectEndpoints` |                                                                                                                   |
| `toggleFavorite` mutation                                                | `src/features/favorites/model/favoritesApi.ts`                            |                                                                                                                   |
| `getRecommendations` endpoint                                            | `src/pages/recommendations/api/recommendationsApi.ts`                     | комбинирует `@features/favorites` + `@features/recommendations` + `@entities/movie` — легально только в page-слое |
| `makeStore`, `store`, `<Provider>`                                       | `src/app/store.ts`, `src/app/providers.tsx`                               |                                                                                                                   |

**Ключевые решения**

- **Фичи не знают про `RootState`.** Селекторы объявляются в `createSlice({ selectors })`; `slice.selectors.*` типизированы формой `{ [reducerPath]: State }`, `useSelector` выводит тип из селектора. `RootState`/`AppDispatch` экспортируются из `app/store.ts` только для тестов и самого `app`.
- **Запросы идут через существующий сгенерированный `apiClient`**: каждый endpoint — `queryFn`, который зовёт `apiClient.*`, маппит DTO текущими `mapDocToMovie`/`mapDtoTo*` и превращает исключение в `{ error: toQueryError(e) }`. `fetchBaseQuery` не используем — интерсептор и типы клиента уже есть.
- **Persist — listener middleware поверх существующих `createStorageSlot`**: начальное состояние slice читается из слота, запись в слот — в listener'е, те же ключи и zod-схемы. Если `slot.set()` вернул `false`, listener диспатчит откат к `getOriginalState()` — сохраняется инвариант «неудачная запись не видна в UI». Эффект listener'а стартует синхронно внутри `dispatch`, поэтому после `dispatch` стейт уже либо применён, либо откатан — на этом держится `boolean`-результат `useProfile().setName`.
- **Синхронизация вкладок**: `slot.subscribe` → `dispatch(hydrated(slot.get()))`; listener игнорирует `hydrated` и rollback-экшен, чтобы не писать значение обратно. `slot.subscribe` срабатывает и на `set()` в своей же вкладке, поэтому `subscribeSlot` пропускает диспатч, когда значение слота уже равно `select(getState())` — иначе каждая запись давала бы лишний рендер, а два toggle избранного в одном тике теряли бы второй оптимистичный id.
- **Favorites — исключение из listener-persist**: запись идёт через RTK Query mutation `toggleFavorite`. `localStorage` играет роль «сервера»: `queryFn` пишет слот, `onQueryStarted` оптимистично диспатчит `toggled(id)` в slice и откатывает при ошибке, `trackEvent('favorite added')` — только после `queryFulfilled`. Так в ветке показаны оба паттерна, и нет двойной записи. Конструкция учебная: mutation здесь только потому, что её требует roadmap 3.1; без сервера хватило бы slice с listener-persist, как у остальных фич, — это оговаривается в README.
- **Теги**: `getRecommendations` — endpoint без аргумента (`providesTags: ['Recommendations']`), id избранного читает из `getState()`. Раз аргумент не меняется, кеш сам не обновится — `toggleFavorite` объявляет `invalidatesTags` — только при успехе (`(_r, error) => (error ? [] : ['Recommendations'])`), иначе перезапрос гонится с откатом и может прочитать неоткатанные id. Фича инвалидирует page-endpoint по имени тега, не импортируя его. Изменение избранного из другой вкладки приходит мимо mutation, поэтому путь tab-sync избранного сам диспатчит `baseApi.util.invalidateTags(['Recommendations'])`.
- **Переиспользование кеша внутри `queryFn`**: `dispatch(endpoint.initiate(arg, { subscribe: false })).unwrap()`. Так `getMoviesByIds` делит кеш с `getMovieDetail` (как сейчас), `getMoviesPage` — с шагами курсора, `getRecommendations` — с обоими. Важно для квоты.
- **Чтение в компонентах — идиоматичные хуки**, без Suspense. `AsyncBoundary` заменяется на `QueryBoundary` (`@shared/ui`): принимает результат запроса структурным типом (без импорта RTK), рендерит `fallback` при `isLoading` или пока `data === undefined` без ошибки (пропущенный/ещё не стартовавший запрос), `ErrorState` c Retry = `refetch` при ошибке (в том числе при неудачном перезапросе со старыми данными — как на `main`, где ошибка заменяет контент), иначе `children(data)`. `ErrorBoundary` для ошибок рендера остаётся.
- **TTL**: `keepUnusedDataFor: 300` на `baseApi` — тот же срок, что `CACHE_TTL_MS`.

**Сознательно теряем** (фиксируем в README и `data-layer.md`):

- 20-секундный error-cooldown `createCachedFetcher` — RTK Query не кеширует ошибку как «свежую»; повторный монтаж компонента перезапрашивает
- `sessionStorage`-персист кеша в DEV
- как побочный плюс уходит DEV-баг с потерей `ApiError.status` при реплее — `status` теперь лежит в сериализуемой ошибке

**Вне объёма**: `Sentry.createReduxEnhancer` (в сторе лежит имя профиля — PII, отдельное решение), `redux-persist`, изменение сценариев e2e.

## Technical Details

```ts
// src/shared/api/queryError.ts
export type QueryError = { status?: number; message: string }
export const toQueryError = (error: unknown): QueryError

// src/shared/api/baseApi.ts
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fakeBaseQuery<QueryError>(),
  tagTypes: ['Recommendations'],
  keepUnusedDataFor: 300,
  endpoints: () => ({}),
})

// src/shared/lib/store/persistSlice.ts
persistSlice({
  startListening,          // от общего listenerMiddleware; persistSlice — дженерик по форме стейта,
                           // shared не знает RootState
  slot,                    // StorageSlot<T>
  select,                  // (state) => T — что писать
  matcher,                 // какие экшены персистим (все экшены slice, кроме hydrated)
  rollback,                // (previous: T) => Action — диспатчится при set() === false
})
subscribeSlot(store, slot, hydrated) // вкладка → стор

// src/app/store.ts
export const makeStore = (preloadedState?) => configureStore({ ... })
export const store = makeStore()
```

- Начальное состояние slices — `initialState: () => slot.get()` (функция): каждый `makeStore()` в тесте читает актуальный `localStorage`.
- Формы стейта: `favorites/watched/watchlist: { ids: number[] }`, `theme: { theme: Theme }`, `profile: { name: string }`.
- Пагинация каталога: внутренний endpoint `getCatalogCursorStep({ params, cursor })` (один сетевой запрос, `withCount` только на первом шаге) + `getMoviesPage({ params, page })`, чей `queryFn` обходит шаги 1..page через `initiate(..., { subscribe: false })` и возвращает `{ movies, totalPages }`. Логика `toTotalPages`/«курсор кончился раньше» переносится как есть. `getSearchMovies({ query, page })` — обычный server-side `page`. Поверх них — единый endpoint `getCatalog({ query, params, page })`: `queryFn` выбирает ветку search/catalog и делегирует через `initiate`. Один endpoint = один хук, поэтому при переключении режима поиск ↔ каталог `data` держит предыдущую сетку (с двумя хуками и `skip` она бы пропадала в скелетон).
- `getRecommendations` возвращает `Movie[] | null` (`null` — избранное пусто/не дало правила; различие `null` vs `[]` для UI сохраняется).
- Stale-while-fetching на `/search`: `data` хука RTK Query держит результат предыдущих аргументов, пока грузятся новые, `isFetching` — индикатор обновления (включая смену режима). Зеркало `useState` + `useDeferredValue` в `useCatalogUpdateStatus` становится не нужно.

## What Goes Where

- **Implementation Steps** — код, тесты, документация в этом репозитории
- **Post-Completion** — ручная проверка DevTools и визуальный прогон

## Implementation Steps

### Task 1: Store, Provider, baseApi и тестовые утилиты

**Model:** opus — фундамент: публичный API стора и ошибки, на котором строятся все остальные задачи

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/shared/api/baseApi.ts`, `src/shared/api/queryError.ts`
- Modify: `src/shared/api/index.ts`
- Create: `src/shared/lib/store/listenerMiddleware.ts`, `src/shared/lib/store/index.ts`
- Modify: `src/shared/lib/index.ts`
- Create: `src/app/store.ts`
- Modify: `src/app/providers.tsx`
- Create: `src/test/renderWithStore.tsx`
- Create: `src/shared/api/queryError.test.ts`, `src/app/store.test.ts`
- Modify: `src/app/providers.test.tsx`
- Modify: тесты компонентов/хуков-потребителей `useFavorites`/`useTheme`/`useWatched`/`useWatchlist`/`useProfile` (страницы, виджеты, `MovieRail`, шапки)

- [x] `pnpm add @reduxjs/toolkit react-redux`
- [x] `queryError.ts`: тип `QueryError` и `toQueryError` (`ApiError` → `{ status, message }`, прочее → `{ message }`)
- [x] `baseApi.ts` по сигнатуре из Technical Details; экспорт из `@shared/api`
- [x] `listenerMiddleware.ts`: общий экземпляр `createListenerMiddleware()` + `startListening` (дженерик по стейту, без `RootState`); экспорт из `@shared/lib`
  - ➕ отклонение: вместо модульного синглтона — фабрика `createAppListenerMiddleware()`, экземпляр создаётся в каждом `makeStore()` (общий экземпляр копил бы listener'ы всех сторов из тестов — см. требование Task 2 про дублирование); `startListening` для Task 2 берётся из экземпляра стора, тип — `StartListening<State>`
- [x] `app/store.ts`: `makeStore(preloadedState?)` (редьюсер `baseApi`, middleware `baseApi` + listener), singleton `store`, типы `RootState`/`AppDispatch`
- [x] `providers.tsx`: обернуть `RouterProvider` в `<Provider store={store}>` внутри `GlobalErrorBoundary`
- [x] `src/test/renderWithStore.tsx`: `renderWithStore(ui, { store?, ...renderOptions })` и `createStoreWrapper(store?)` для `renderHook`; по умолчанию — свежий `makeStore()`
- [x] один раз перевести тесты потребителей клиентских хуков на `renderWithStore`/`createStoreWrapper` (пока стор пустой — это no-op-обёртка), чтобы Tasks 3–6 не трогали одни и те же файлы повторно
- [x] тесты `toQueryError` (ApiError со статусом, обычный Error, не-Error)
- [x] тесты `makeStore`: два вызова дают независимые сторы; в стейте есть `api`
- [x] обновить `providers.test.tsx`
- [x] `make test && make typecheck && make lint` — зелёные

### Task 2: Инфраструктура persist на listener middleware

**Model:** opus — порядок dispatch/rollback и защита от записи обратно: ошибка легко проходит собственные тесты

**Files:**

- Create: `src/shared/lib/store/persistSlice.ts`, `src/shared/lib/store/persistSlice.test.ts`
- Modify: `src/shared/lib/store/index.ts`, `src/shared/lib/index.ts`
- Modify: `src/app/store.ts`

- [x] `persistSlice({ startListening, slot, select, matcher, rollback })`: эффект пишет `select(getState())` в слот; при `false` диспатчит `rollback(select(getOriginalState()))`
- [x] `subscribeSlot(store, slot, { select, hydrated })`: `slot.subscribe` → `dispatch(hydrated(slot.get()))`, только если значение слота отличается от `select(getState())` (подписка срабатывает и на `set()` своей вкладки); возвращает unsubscribe
- [x] rollback-экшен и `hydrated` не должны попадать под `matcher`
- [x] `persistSlice` — дженерик по форме стейта (`shared` не знает `RootState`)
- [x] WHY-комментарий: эффект стартует синхронно внутри `dispatch`, поэтому вызывающий код видит итоговый стейт сразу после `dispatch`
- [x] в `app/store.ts` — точка регистрации persist (`setupPersistence(store)`), пока без slices; listener'ы не должны дублироваться при повторном `makeStore()`, а подписки на слоты — утекать между тестами (teardown у стора/`renderWithStore`)
  - ➕ решение: `makeStore()` возвращает стор с `teardown()` (отписка от слотов + `clearListeners()`); `renderWithStore`/реэкспорт `makeStore` из `src/test/renderWithStore.tsx` регистрируют созданные сторы и снимают их в `afterEach`; `persistSlice` сам исключает `rollback` из `matcher` (`rollback` — action creator с `.match`), `hydrated` исключает вызывающий; `subscribeSlot` сравнивает значения через `JSON.stringify`
- [x] тест: экшен из `matcher` → значение в `localStorage`
- [x] тест: `slot.set` возвращает `false` → стейт откатан синхронно, сразу после `dispatch`
- [x] тест: `hydrated` обновляет стейт и не вызывает `slot.set`
- [x] тест: `storage`-событие из другой вкладки попадает в стор
- [x] тест: запись из своей вкладки не порождает `hydrated`
- [x] `make test && make typecheck && make lint` — зелёные

### Task 3: Theme slice

**Model:** sonnet — сигнатура хука сохраняется, существующие тесты показывают паритет

**Files:**

- Create: `src/features/theme/model/themeSlice.ts`, `src/features/theme/model/themeSlice.test.ts`
- Modify: `src/features/theme/model/useTheme.ts`, `src/features/theme/model/useTheme.test.tsx`
- Modify: `src/features/theme/index.ts`
- Modify: `src/app/store.ts`

- [x] `themeSlice`: `initialState: () => ({ theme: themeSlot.get() })`, редьюсеры `themeSet`, `hydrated`, селектор `selectTheme`
- [x] экспорт редьюсера и регистрации persist из `@features/theme`; подключить в `app/store.ts` (`persistSlice` + `subscribeSlot`)
- [x] `useTheme`: `useSelector`/`useDispatch` вместо `useStorageSlot`; `matchMedia`-логика и `data-theme`-эффект без изменений; тип `UseThemeResult` тот же
- [x] ключ `kinoshka:theme` и формат значения не меняются — инлайн-скрипт `index.html` не трогаем
- [x] тесты slice (редьюсеры, начальное состояние из слота)
- [x] обновить `useTheme.test.tsx` и тесты потребителей под стор; добавить кейс «значение сохраняется в `localStorage`»
- [x] `make test && make typecheck && make lint` — зелёные

### Task 4: Watched и Watchlist slices

**Model:** sonnet — повторяет паттерн Task 3 на двух одинаковых id-списках

**Files:**

- Create: `src/features/watched/model/watchedSlice.ts`, `src/features/watched/model/watchedSlice.test.ts`
- Create: `src/features/watchlist/model/watchlistSlice.ts`, `src/features/watchlist/model/watchlistSlice.test.ts`
- Modify: `src/features/watched/model/useWatched.ts`, `src/features/watchlist/model/useWatchlist.ts` и их тесты
- Modify: `src/features/watched/index.ts`, `src/features/watchlist/index.ts`
- Modify: `src/app/store.ts`

- [x] `watchedSlice`/`watchlistSlice`: `{ ids }`, редьюсеры `toggled(id)`, `hydrated(ids)`, селектор `selectIds`
- [x] подключить редьюсеры и persist в `app/store.ts`
- [x] `useWatched`/`useWatchlist` на `useSelector`/`useDispatch`, возвращаемая форма та же
- [x] списки независимы друг от друга и от Favorites (см. `.claude/rules/user-lists.md`) — никаких перекрёстных редьюсеров
- [x] тесты slices; два `toggled` подряд в одном тике не затирают друг друга
- [x] обновить тесты хуков и потребителей
- [x] `make test && make typecheck && make lint` — зелёные

### Task 5: Profile slice

**Model:** sonnet — паттерн задан Task 2–3, `boolean`-контракт покрыт существующими тестами `/profile`

**Files:**

- Create: `src/features/profile/model/profileSlice.ts`, `src/features/profile/model/profileSlice.test.ts`
- Modify: `src/features/profile/model/useProfile.ts` и его тест
- Modify: `src/features/profile/index.ts`
- Modify: `src/app/store.ts`
- Modify: тесты потребителей (`ProfileAvatar`, страница `/profile`, шапки)

- [x] `profileSlice`: `{ name }`, редьюсеры `nameSet`, `hydrated`, селектор `selectName`
- [x] `useProfile`: `setName`/`clearName` по-прежнему возвращают `boolean` — диспатч, затем сравнение `selectName(store.getState())` с ожидаемым значением (через `useStore<{ profile: ProfileState }>()`); WHY-комментарий со ссылкой на синхронный rollback из Task 2
- [x] `normalizeProfileName` применяется до диспатча, как сейчас
- [x] имя пользователя не должно попадать в `aria-label`/`title` новыми путями (см. `.claude/rules/sentry.md`)
- [x] тесты slice; тест `setName` → `false` и стейт не изменился при отказе `localStorage`
- [x] обновить тесты потребителей
- [x] `make test && make typecheck && make lint` — зелёные

### Task 6: Favorites slice и mutation `toggleFavorite` с optimistic update

**Model:** opus — порядок optimistic/rollback/analytics и единственный путь записи: ошибка проходит поверхностные тесты

**Files:**

- Create: `src/features/favorites/model/favoritesSlice.ts`, `src/features/favorites/model/favoritesSlice.test.ts`
- Create: `src/features/favorites/model/favoritesApi.ts`, `src/features/favorites/model/favoritesApi.test.ts`
- Modify: `src/features/favorites/model/useFavorites.ts` и его тест
- Modify: `src/features/favorites/index.ts`
- Modify: `src/app/store.ts`
- Modify: тесты потребителей `useFavorites`

- [x] `favoritesSlice`: `{ ids }`, редьюсеры `toggled(id)`, `hydrated(ids)`, селекторы `selectIds`; экспорт `selectFavoriteIds` из barrel (нужен Task 12)
- [x] `favoritesApi` (`baseApi.injectEndpoints`): mutation `toggleFavorite(id)` — `queryFn` считает следующее значение от `favoritesSlot.get()`, пишет слот, при `false` возвращает `{ error }`; `invalidatesTags: (_r, error) => (error ? [] : ['Recommendations'])`
- [x] `onQueryStarted`: оптимистичный `dispatch(toggled(id))`; после `queryFulfilled` — `trackEvent('favorite added')` только при добавлении; в `catch` — откат повторным `toggled(id)`
- [x] favorites **не** регистрируется в `persistSlice` (единственный путь записи — mutation); `subscribeSlot` для синхронизации вкладок подключить; при `hydrated` из другой вкладки дополнительно диспатчить `baseApi.util.invalidateTags(['Recommendations'])`
- [x] `useFavorites`: `ids`/`isFavorite`/`toggle` на `useSelector` + `useToggleFavoriteMutation`; `add`/`remove`/`clear` удалить, если у них нет потребителей вне тестов (проверить grep'ом), иначе реализовать тем же способом
- [x] тесты slice
- [x] тесты mutation: успех (стейт, `localStorage`, `trackEvent`), отказ записи (откат стейта, `trackEvent` не вызван), удаление не шлёт событие
- [x] тест: два `toggle` разных id в одном тике — оба id в стейте и в `localStorage`
- [x] тесты инвалидации: при ошибке записи тег не инвалидируется; `storage`-событие из другой вкладки инвалидирует `Recommendations`
- [x] обновить тесты хука и потребителей
- [x] `make test && make typecheck && make lint` — зелёные

### Task 7: `QueryBoundary` в `@shared/ui`

**Model:** sonnet — контракт компонента описан в плане, поведение проверяется тестами

**Files:**

- Create: `src/shared/ui/QueryBoundary/index.tsx`, `src/shared/ui/QueryBoundary/QueryBoundary.test.tsx`
- Modify: `src/shared/ui/index.ts`

- [x] пропсы: `query: { data?: T; isLoading: boolean; isError: boolean; error?: unknown; refetch: () => unknown }`, `fallback?`, `errorFallback?: ({ error, reset }) => ReactNode`, `children: (data: T) => ReactNode` — структурный тип, без импорта RTK
- [x] `isError` → `errorFallback` (по умолчанию `ErrorState`), `reset` = `refetch` — даже если есть старые `data`; `isLoading` или `data === undefined` → `fallback` (по умолчанию `Spinner`); иначе `children(data)` — `children` никогда не получает `undefined`
- [x] сообщение ошибки берётся из `QueryError.message`
- [x] `ErrorState` по-прежнему не зависит от `react-router`
- [x] тесты: три состояния, Retry вызывает `refetch`, кастомный `errorFallback`, пропущенный запрос (`data === undefined`, не loading) → `fallback`, ошибка перезапроса при старых данных → ошибка
- [x] `make test && make typecheck && make lint` — зелёные

### Task 8: Endpoints рейлов и страницы Home/Popular

**Model:** sonnet — перенос трёх однотипных фетчеров по заданному шаблону

**Files:**

- Create: `src/entities/movie/api/movieApi.ts`, `src/entities/movie/api/movieApi.test.ts`
- Modify: `src/entities/movie/hooks/{usePopularMovies,useNewMovies,useTopRatedMovies}.ts`, `src/entities/movie/hooks/index.ts`
- Delete: `src/entities/movie/api/{getMovies,getPopularMovies}.ts` и их тесты (логика уезжает в `queryFn`)
- Modify: `src/pages/home/ui/Home/Home.tsx`, `src/pages/popular/ui/Popular/Popular.tsx`, виджет рейла (`src/widgets/movie-rail/**`) и их тесты

- [x] `movieApi = baseApi.injectEndpoints(...)`: `getMovies(params)`, `getPopularMovies(params)` — `queryFn` поверх `apiClient`, маппинг и проверка error-DTO (`'statusCode' in response.data`) сохраняются
- [x] хуки `usePopularMovies`/`useNewMovies`/`useTopRatedMovies` возвращают результат query с теми же фиксированными параметрами; экспорты `invalidate*` удалить
- [x] `Home`, `Popular`, рейлы: `AsyncBoundary` → `QueryBoundary`, Retry = `refetch`; скелетоны и тексты ошибок те же
- [x] не сломать lazy-mount/`content-visibility` рейлов (см. `.claude/rules/performance.md`)
- [x] тесты endpoints (успех, HTTP-ошибка → `QueryError` со `status`, error-DTO)
- [x] обновить тесты хуков, `Home`, `Popular`, рейлов (включая Retry)
- [x] `make test && make typecheck && make lint` — зелёные

### Task 9: Endpoints детальных страниц (movie, person)

**Model:** sonnet — перенос фетчеров, правила 404/images зафиксированы в `data-layer.md` и тестах

**Files:**

- Modify: `src/entities/movie/api/movieApi.ts`, `src/entities/movie/api/movieApi.test.ts`
- Create: `src/entities/person/api/personApi.ts`, `src/entities/person/api/personApi.test.ts`
- Modify: `src/entities/movie/hooks/useMovieDetail.ts`, `src/entities/person/hooks/usePersonDetail.ts`
- Delete: `src/entities/movie/api/{getMovieDetail,getMovieImages}.ts`, `src/entities/person/api/getPersonDetail.ts` и их тесты
- Modify: `src/pages/movie/**`, `src/pages/person/**` и их тесты
- Modify: `src/entities/movie/api/getMoviesByIds.ts` (временный мост до Task 12)
- Modify: `src/entities/movie/index.ts` (тип `MovieImage` реэкспортируется из удаляемого `getMovieImages.ts`)

- [x] endpoints `getMovieDetail(id)`, `getMovieImages(id)`, `getPersonDetail(id)`
- [x] сохранить: ошибка картинок → `images: []`, страница рендерится; ошибка detail (включая 404) → состояние ошибки
- [x] 404-вью: проверка `error.status === 404` по `QueryError` вместо `instanceof ApiError`
- [x] `MoviePage`/`PersonPage`: `QueryBoundary`, Retry = `refetch`; `invalidateMovieDetail`/`invalidatePersonDetail` удалить
- [x] старый фетчер `getMoviesByIds` продолжает работать до Task 12 (им пользуются рекомендации): получает детали через `store`-независимую чистую функцию запроса, экспортированную из `movieApi.ts`; `isNotFound` — по-прежнему по `ApiError` внутри этого моста
- [x] тесты endpoints (успех, 404, сбой images)
- [x] обновить тесты хуков и страниц
- [x] `make test && make typecheck && make lint` — зелёные

### Task 10: Endpoint `getMoviesByIds` и страницы списков

**Model:** sonnet — логика `allSettled`/404 переносится как есть, шаблон `initiate` задан планом

**Files:**

- Modify: `src/entities/movie/api/movieApi.ts`, `src/entities/movie/api/movieApi.test.ts`
- Modify: `src/features/{favorites,watched,watchlist}/model/use*Movies.ts` и их тесты
- Modify: `src/pages/recommendations/model/useRecommendedMovies.ts` (мост до Task 12)
- Modify: `src/pages/{favorites,watched,watchlist}/**` и их тесты
- Modify: `src/entities/movie/index.ts`

- [x] endpoint `getMoviesByIds(ids)`: `queryFn` получает каждый id через `dispatch(getMovieDetail.initiate(id, { subscribe: false }))` — кеш деталей общий с `/movie/:id`
- [x] сохранить: 404-id молча выпадает (проверка `QueryError.status === 404` вместо `instanceof ApiError`); если фильмов 0 и есть не-404 сбой — ошибка
- [x] старый `getMoviesByIds.ts` и его экспорт из barrel **не удалять** — до Task 12 `useRecommendedMovies` зовёт `use(getMoviesByIds(ids))` сам (id из `useFavorites()`), т.к. `useFavoriteMovies` больше не Suspense-значение
- [x] `useFavoriteMovies`/`useWatchedMovies`/`useWatchlistMovies` возвращают результат query
- [x] страницы `/favorites`, `/watched`, `/watchlist`: `QueryBoundary`; пустое состояние при пустом списке id без запроса (`skip`)
- [x] при изменении списка сетка не должна мигать скелетоном — рендер от `data` (держит предыдущий результат) + `isFetching`
- [x] тесты endpoint (успех, частичный 404, полный сбой, переиспользование кеша detail — один запрос на id)
- [x] обновить тесты хуков и страниц
- [x] `make test && make typecheck && make lint` — зелёные

### Task 11: Каталог и поиск — server-side pagination

**Model:** opus — обход курсора через вложенные `initiate` и stale-while-fetching на `/search`: много решений, ошибки неочевидны

**Files:**

- Modify: `src/entities/movie/api/movieApi.ts`, `src/entities/movie/api/movieApi.test.ts`
- Delete: `src/entities/movie/api/getSearchMovies.ts` и его тест (`getMoviesPage.ts` остаётся до Task 12 — им пользуются рекомендации)
- Modify: `src/entities/movie/index.ts`
- Modify: `src/pages/search/model/{useMovieCatalog,useCatalogUpdateStatus}.ts` и их тесты
- Modify: `src/pages/search/ui/**` и их тесты

- [x] endpoint `getCatalogCursorStep({ params, cursor })` — один запрос, `withCount` только при `cursor === undefined`
- [x] endpoint `getMoviesPage({ params, page })`: обход шагов 1..page через `initiate(..., { subscribe: false })`; `toTotalPages`, «курсор кончился раньше» → пустой хвост, `PER_PAGE`/`MAX_PAGES` — как сейчас
- [x] endpoint `getSearchMovies({ query, page })`
- [x] endpoint `getCatalog({ query, params, page })`: `queryFn` делегирует в `getSearchMovies` или `getMoviesPage` через `initiate(..., { subscribe: false })`
- [x] `useMovieCatalog`: один хук `useGetCatalogQuery`, единая форма `{ movies, mode, totalPages }` + статусы query; `mode` — от текущих аргументов; `invalidateMovieCatalog` удалить
- [x] `useCatalogUpdateStatus`: убрать зеркало `useState` + `useDeferredValue`, `isUpdating` = `isFetching && !isLoading`; если хук вырождается — удалить его и читать статус из `useMovieCatalog`
  - ➕ решение: хук выродился и удалён вместе с тестом, `isUpdating` отдаёт `useMovieCatalog`; пункт про `areFiltersEqual` убран из `.claude/rules/search-catalog.md` (ключ кеша RTK Query сериализует аргументы, поимённое сравнение не нужно)
- [x] `/search`: `QueryBoundary`, старые результаты остаются на экране во время загрузки новых; инварианты URL-стейта из `.claude/rules/search-catalog.md` не меняются
- [x] тесты endpoints: страница N делает N запросов, страница N+1 после N — один (кеш шагов), `total` недоступен → `MAX_PAGES`, обрыв курсора; `getCatalog` выбирает ветку по `query`
- [x] обновить тесты `useMovieCatalog`, статуса обновления, страницы поиска (Retry, индикатор обновления, при переключении поиск ↔ каталог старая сетка остаётся на экране)
- [x] `make test && make typecheck && make lint` — зелёные

### Task 12: Recommendations — endpoint с tag-based invalidation

**Model:** opus — порядок optimistic-обновления, инвалидации и перезапроса: ошибка проходит собственные тесты

**Files:**

- Create: `src/pages/recommendations/api/recommendationsApi.ts`, `src/pages/recommendations/api/recommendationsApi.test.ts`
- Modify: `src/pages/recommendations/model/useRecommendedMovies.ts`
- Modify/Delete: `src/pages/recommendations/model/useRecommendedMovies{,.retry}.test.tsx`
- Modify: `src/pages/recommendations/ui/**` и их тесты
- Delete: `src/entities/movie/api/{getMoviesByIds,getMoviesPage}.ts` и их тесты
- Modify: `src/entities/movie/index.ts`

- [x] endpoint `getRecommendations()` (без аргумента): `selectFavoriteIds(getState())` → `getMoviesByIds.initiate` → `computeRecommendationQuery` → `getMoviesPage.initiate({ params, page: 1 })`; возвращает `Movie[] | null`; `providesTags: ['Recommendations']`
- [x] `useRecommendedMovies` — тонкая обёртка над query; модульная переменная `lastQuery` и `invalidateRecommendations` удаляются
- [x] страница: `QueryBoundary`, различие `null` (нет правила) vs `[]` (пусто) сохраняется; Retry = `refetch`
- [x] карточки по-прежнему без favorite-toggle, но с watchlist-toggle
- [x] удалить старые фетчеры `getMoviesByIds.ts`/`getMoviesPage.ts` и их экспорты из barrel — последний потребитель ушёл
- [x] тест: `toggleFavorite` при активной подписке вызывает перезапрос рекомендаций (инвалидация по тегу), и перезапрос видит уже обновлённые id
- [x] тест: без подписчика запись кеша сбрасывается и перезапрашивается при следующем заходе на страницу
- [x] тесты endpoint: пустое избранное → `null`, успех, ошибка
- [x] обновить тесты страницы
- ➕ решение: мост `fetchMovieDetail` (Task 9) встроен обратно в `queryFn` `getMovieDetail` вместе со своим тестом — последний его потребитель (`getMoviesByIds.ts`) удалён; хуковые тесты `useRecommendedMovies{,.retry}.test.tsx` удалены — хук стал тонкой обёрткой, их сценарии перенесены в `recommendationsApi.test.ts`
- [x] `make test && make typecheck && make lint` — зелёные

### Task 13: Справочники жанров и стран на RTK Query

**Model:** opus — нужно совместить кеш RTK Query с 7-дневным `localStorage`-фолбэком и кулдауном: решения по деталям остаются за исполнителем

**Files:**

- Modify: `src/entities/movie/api/movieApi.ts`, `src/entities/movie/api/movieApi.test.ts`
- Modify: `src/entities/movie/api/{createDictionaryCache,genreDictionaryCache,countryDictionaryCache,getGenreDictionary,getCountryDictionary}.ts` и их тесты
- Modify: `src/entities/movie/hooks/{useGenreDictionary,useCountryDictionary}.ts` и их тесты
- Modify: `src/entities/movie/index.ts`, `src/test/setup.ts`
- Modify: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.tsx` и селектор стран, их тесты

- [x] endpoints `getGenreDictionary()`, `getCountryDictionary()`; сетевой запрос — только через RTK Query
- [x] `localStorage`-слот остаётся как персистентный фолбэк: успешный ответ пишется в слот (`onQueryStarted`), хук синхронно отдаёт `data ?? кеш слота ?? STATIC_FALLBACK_*`
- [x] запрос пропускается (`skip`), пока кеш слота свежий (7 дней)
- [x] сохранить инварианты: пустой ответ не затирает кеш и не зацикливает перезапрос; неудача не трогает существующий кеш; повтор после неудачи не чаще кулдауна 60 с
- [x] `createDictionaryCache` сократить до того, что осталось нужно (слот + свежесть + кулдаун), in-flight-дедупликацию и `generation` удалить — их даёт RTK Query; `reset*DictionaryState` в `setup.ts` убрать, если стало не нужно
- [x] селекторы жанров/стран рендерятся без блокировки, как сейчас
- [x] тесты: свежий кеш → нет запроса; протухший → фоновое обновление; пустой ответ; ошибка + кулдаун
- [x] обновить тесты хуков и селекторов
- ➕ решение: инстансы `genreDictionaryCache`/`countryDictionaryCache` живут в `createDictionaryCache.ts`, файлы `genreDictionaryCache.ts`/`countryDictionaryCache.ts`/`getGenreDictionary.ts`/`getCountryDictionary.ts` и их тесты удалены (запрос — в `queryFn`, тесты — в `movieApi.test.ts`); кулдаун проверяется в `queryFn` (RTK Query перезапрашивает упавший запрос на каждой новой подписке); пустой ответ теперь не пишется в слот вовсе (раньше писался `items: []` со свежим `fetchedAt`), от зацикливания защищает закешированный в RTK Query ответ + кулдаун; кулдаун модульный, поэтому `resetDictionaryCooldowns` в `setup.ts` остался (заменил оба `reset*DictionaryState`)
- [x] `make test && make typecheck && make lint` — зелёные

### Task 14: Удаление старого data-layer

**Model:** sonnet — удаление по списку, knip/typecheck/тесты ловят ошибки

**Files:**

- Delete: `src/shared/lib/cachedFetcher/**`, `src/shared/lib/sessionCache/**`
- Delete: `src/shared/ui/AsyncBoundary/**` (если не осталось потребителей)
- Delete: `src/shared/lib/storage/useStorageSlot.ts` (если не осталось потребителей)
- Modify: `src/shared/lib/index.ts`, `src/shared/lib/storage/index.ts`, `src/shared/ui/index.ts`
- Modify: `src/test/setup.ts`
- Modify: устаревшие упоминания `AsyncBoundary` в `src/app/GlobalErrorBoundary{,.test}.tsx`, `src/app/layouts/AppLayout{,.test}.tsx`, `src/shared/ui/ErrorBoundary/*.test.tsx`, `e2e/movie-detail.spec.ts`, `e2e/recommendations.spec.ts` (только комментарии, сценарии не меняются)

- [ ] grep по `createCachedFetcher`, `createSessionCache`, `resetAllCachedFetchers`, `AsyncBoundary`, `useStorageSlot`, `invalidate[A-Z]`, `use(` — потребителей не осталось
- [ ] удалить модули и экспорты из barrel-файлов
- [ ] `setup.ts`: убрать `resetAllCachedFetchers` и устаревшие комментарии
- [ ] обновить комментарии в коде, ссылающиеся на удалённые механизмы
- [ ] `make knip` — без новых находок
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 15: Бюджеты бандла и замер разницы с `main`

**Model:** sonnet — измерение и обновление чисел, `make size` показывает результат

**Files:**

- Modify: `package.json` (`size-limit`)
- Create: `docs/concepts/rtk-bundle-diff.md` (сырые цифры для README)

- [ ] `make build-only && make size` на ветке; записать gzip-размеры всех чанков
- [ ] те же цифры для `main` (из текущих лимитов `size-limit`/CI или сборкой `main` в отдельном worktree)
- [ ] обновить лимиты `vendor`/`shared`/`page-*` под фактические размеры с тем же запасом, что принят в проекте (см. `.claude/rules/build-budgets.md`)
- [ ] проверить, что `@reduxjs/toolkit`/`react-redux` попали в `vendor`, а не в page-чанки
- [ ] записать таблицу diff по чанкам в `docs/concepts/rtk-bundle-diff.md`
- [ ] `make size` — зелёный

### Task 16: Verify acceptance criteria

**Model:** sonnet — сверка результата с планом и критериями Phase 3, исправление расхождений

- [ ] все шесть пунктов roadmap 3.1 реализованы
- [ ] в `src/` нет `use(` для данных, `createCachedFetcher`, `useStorageSlot`
- [ ] ключи `localStorage` те же, что на `main` (`kinoshka:*`); `index.html` и CSP-хэш не изменены
- [ ] `make check` (format-check, lint, build)
- [ ] `make test`
- [ ] `make knip`, `make size`
- [ ] `make e2e` — один прогон (квота 200 запросов/день); сценарии спеков не менялись

### Task 17: [Final] Документация

**Model:** sonnet — документация описывает уже построенное поведение

**Files:**

- Modify: `README.md`
- Modify: `.claude/rules/{data-layer,storage,build-budgets,search-catalog}.md`, `AGENTS.md`
- Modify: `plans/roadmap.md`

- [ ] `README.md`: раздел ветки `rtk` — разбор паттернов (slices в фичах без `RootState`, persist через listener + rollback, optimistic mutation поверх `localStorage`, `queryFn` + `initiate` для композиции кеша, обход курсора, теги), плюсы/минусы, что потеряно относительно `main`, таблица bundle-size diff из Task 15
- [ ] `README.md`: оговорка про `toggleFavorite` — mutation поверх `localStorage` сделана ради демонстрации optimistic update (roadmap 3.1); в реальном проекте без серверного избранного достаточно slice с listener-persist, а mutation оправдана, когда запись может отказать асинхронно
- [ ] `.claude/rules/data-layer.md` (на английском): заменить разделы про `createCachedFetcher`/`AsyncBoundary`/`invalidate*` на решения ветки — только неочевидное и причины, без пересказа кода
- [ ] `paths:` во frontmatter `data-layer.md` — под новые файлы (`*Api.ts`, `QueryBoundary`, `pages/recommendations/api`); поправить упоминания удалённых механизмов в `build-budgets.md` и `search-catalog.md`
- [ ] `.claude/rules/storage.md` (на английском): slices как единственные читатели слотов, синхронный rollback, favorites пишется только через mutation
- [ ] `AGENTS.md`: раздел «Data (summary)», строки таблицы топиков, gotcha про `useDeferredValue` (если больше не применима в коде — убрать)
- [ ] `plans/roadmap.md`: отметить `[x]` пункты 3.1 и обновить трекер прогресса
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка**

- Redux DevTools: видны slices `favorites`/`theme`/`watched`/`watchlist`/`profile`, записи `api/queries`, экшены `toggleFavorite` (pending/fulfilled) и инвалидация `Recommendations` (критерий Phase 3 «DevTools видит state-tool артефакты»)
- смена темы без вспышки при перезагрузке (инлайн-скрипт + slice читают один ключ)
- две вкладки: изменение избранного/темы в одной отражается в другой
- `/search`: при смене страницы/фильтра старая сетка остаётся на экране с индикатором обновления
- приватный режим/переполненный `localStorage`: избранное не «залипает» в UI, `/profile` показывает ошибку сохранения

**Наблюдать после миграции**

- расход квоты API: без 20-секундного error-cooldown повторный монтаж после 403 сразу перезапрашивает
- при появлении roadmap 3.8 — перенести таблицу bundle diff в README `main`
