# Миграция на Reatom v1001: state, async, URL и роутинг

## Overview

Ветка `reatom` — сравнительная ветка фазы 3 роадмапа (`plans/roadmap.md`, пункт 3.3). Пункт написан
под Reatom v3; план реализует его на **Reatom v1001** (`@reatom/core@1001.3.0`,
`@reatom/react@1001.0.1`) в объёме «полный стек»:

- **client state** — `createStorageSlot` + `useSyncExternalStore` → атомы с нативным persist;
- **server state** — `createCachedFetcher` + `use()` + Suspense → `computed(async) + withAsyncData`
  поверх кэшируемых `action + withAsync + withCache`, loaders роутов;
- **URL state** — `useSearchParams` → `computed` поверх `urlAtom` и actions с одной записью в URL;
- **routing** — React Router → `reatomRoute` (layout-роут, `render`/`outlet()`, loaders).

Соответствие чекбоксам 3.3 (v3 → v1001):

| 3.3 (v3)                                       | v1001 в этом плане                                                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `pnpm add @reatom/framework @reatom/npm-react` | `pnpm add @reatom/core @reatom/react`, dev: `@reatom/vite`                                                                 |
| Atoms на каждое поле, actions для мутаций      | `atom` / `reatomSet` / `reatomEnum` для client state; поля URL-состояния — `computed` от `urlAtom`, мутации — actions      |
| `reatomAsync` / `reatomResource`               | `action().extend(withAsync())` / `computed(async).extend(withAsyncData())`                                                 |
| Memoized derived atoms                         | `computed`: `resolvedTheme`, `profileInitials`, `filters`, `activeChips`, `catalogParams`, `recommendationQuery`, `genres` |
| README ветки                                   | раздел в `README.md` — Task 20                                                                                             |

Ветка не мержится в `main` (CI-блок), поэтому совместимость формата `localStorage` с `main` не
требуется: старые «сырые» значения читаются как отсутствующие и дают дефолт.

## Context (from discovery)

**Код проекта**

- Client state (5 слотов): `src/features/{favorites,watched,watchlist,theme,profile}/model/*` поверх
  `src/shared/lib/storage/`. Тот же слот используют словари: `src/entities/movie/api/createDictionaryCache.ts`.
- Server state: `src/shared/lib/{cachedFetcher,sessionCache}/`, `src/entities/movie/api/get*.ts`,
  `src/entities/person/api/getPersonDetail.ts`, хуки `src/entities/{movie,person}/hooks/*`,
  `src/features/*/model/use*Movies.ts`, `src/pages/recommendations/model/useRecommendedMovies.ts`,
  `src/shared/ui/AsyncBoundary/`.
- URL state: `src/features/catalog-filter/model/useFilterState.ts`,
  `src/pages/search/model/{useMovieCatalog,usePageSync,useCatalogUpdateStatus,useSearchAnalytics}.ts`,
  `src/widgets/header/ui/Header/Header.tsx`, `src/pages/home/ui/HeroSection/HeroSection.tsx`.
- Routing: `src/app/{router,providers}.tsx`, `src/app/layouts/AppLayout.tsx`, `src/app/sentry.ts`,
  `src/main.tsx`; `react-router` импортируют 22 прод-файла и 32 тестовых файла (из 122). Используются
  `Link`, `NavLink`, `useNavigate`, `useMatch`, `useLocation`, `useParams`, `useSearchParams`,
  `ScrollRestoration`.
- Сопутствующее: inline-скрипт темы в `index.html` читает `kinoshka:theme` напрямую, его sha256 зашит
  в CSP (`csp.md`); 22 тестовых файла сидят `localStorage.setItem` в сыром формате; e2e-спеки
  `localStorage` напрямую не трогают; `size-limit` (13 записей) и `codeSplitting`-группы в
  `vite.config.ts`.

**Проверенные факты о Reatom** (по исходникам `reatom/reatom@56c86f2`, опубликованному `dist` и
экспериментам на `dist` в node + jsdom; ⚠️ — ловушки и расхождения с документацией)

- ⚠️ **React Compiler.** Тело `reatomComponent(() => …)` компилятор не трогает; обычный компонент с
  прямым вызовом `someAtom()` компилируется в «вычислить один раз и закэшировать» — значение
  устаревает навсегда; `useAtom` корректен.
- ⚠️ **Persist TTL.** В `1001.3.0` дефолт `time` — `MAX_SAFE_TIMEOUT` (~24,8 дня), запись с истёкшим
  `to` удаляется при чтении. Handbook и `main` репозитория говорят `Number.MAX_SAFE_INTEGER`.
  `Infinity` нельзя — сериализуется в `null`.
- ⚠️ **Persist `schema`** при невалидных данных бросает `TypeError` из чтения атома. Невалидный JSON
  и значение без конверта `PersistRecord` дают дефолт. `fromSnapshot` вызывается с одним аргументом.
- **Сбой записи** внутри `reatomPersist` проглатывается, атом обновляется в памяти; запись в
  хранилище синхронна внутри `.set()`.
- `withLocalStorage` при недоступном `localStorage` сам переходит на хранение в памяти; кросс-таб
  синхронизация — через событие `storage`, пока атом подключён.
- ⚠️ **`withCache` на `computed` не экономит запрос**: тело выполняется до поиска в кэше, запрос
  уходит и лишь потом отменяется. На `action` попадание в кэш вызов пропускает, параллельные вызовы
  делят один запрос. Отклонённый результат не кэшируется; `withAsync` должен стоять раньше
  `withCache`; `withPersist` навязывает ключ `cacheAtom.name` и свой `fromSnapshot`.
- ⚠️ **`withSearchParams` не годится для мутаций нескольких параметров**: при записи нескольких
  атомов в одном тике в URL попадает только первый; реактивный сброс через `withComputed` меняет
  атом, но не URL; неподписанный атом в URL не пишет. Один `urlAtom.set(fn, true)` с несколькими
  ключами даёт один `replaceState`.
- ⚠️ **`withComputed(() => source())`** перезаписывает прямую запись; рабочая форма —
  `withComputed(state => { ifChanged(source, v => { state = v }); return state })`.
- **Роутинг**: loader — `computed(async)` с `withAsyncData({ status: true })`; `render` — не
  React-компонент; `<a href>` перехватывается `urlAtom` (кроме `target=_blank`, чужого origin,
  `rel=external|nofollow`, `download`, не-левых кликов и кликов с модификаторами);
  `loader.data()` не очищается при уходе с роута; `RouteChild` расширяется через `declare module`.
- ⚠️ **Клик по ссылке идёт мимо `urlAtom.sync`**: обработчик сам делает `history.pushState({}, …)`.
  Программная навигация пишет в `history` через `setTimeout(0)`.
- ⚠️ **`is404`** при pathless layout-роуте всегда `false`.
- ⚠️ **`context.reset()`** изолирует состояние, но не снимает слушатели `popstate` и клика,
  поставленные `urlAtom.init`; их снимает `urlAtom.init.abort()`.
- **Нет из коробки**: восстановления скролла, интеграции с Sentry. Для HMR роутов есть `@reatom/vite`.
- **Suspense** в справочнике — только для одноразовой глобальной инициализации.
- `@reatom/core/test` в npm-пакете не экспортируется.

## Development Approach

- **testing approach**: Regular (сначала код, затем тесты в той же задаче)
- завершать каждую задачу полностью, прежде чем переходить к следующей
- небольшие сфокусированные изменения
- **CRITICAL: каждая задача обязана включать новые/обновлённые тесты** для изменённого кода:
  unit-тесты моделей (atoms/actions/computed), успешные и ошибочные сценарии
- **CRITICAL: все тесты зелёные перед следующей задачей** (`make test`, `make typecheck`, `make lint`)
- **CRITICAL: обновлять этот файл при изменении объёма работ**
- комментарии в коде — на русском, только WHY

## Testing Strategy

- **unit**: модели тестируются без React в дефолтном контексте. Атомы, чьё поведение зависит от
  подключения (persist, URL), в тестах подписаны. Сеть — MSW.
- **изоляция** (`afterEach`): `cleanup()` → `urlAtom.init.abort()` → `context.reset()` → сброс
  модульного состояния вне атомов.
- **компонентные**: Testing Library; URL задаётся и читается хелпером `renderWithRouter` (Task 11).
- **URL-состояние**: проверяется сам URL, а не только значение атома.
- **e2e (Playwright)**: спеки правятся только там, где меняется наблюдаемое поведение. Полный
  прогон — один раз в Task 19 (квота API 200 запросов/сутки).

## Progress Tracking

- отмечать выполненное `[x]` сразу
- новые задачи — с префиксом ➕, блокеры — с ⚠️
- при отклонении от плана обновлять план

## Solution Overview

**1. Привязка к React — `reatomComponent`.** Компонент, читающий атомы, объявляется как
`export const Foo = reatomComponent(({ … }: FooProps) => …, 'Foo')`; обработчики — `wrap(...)`.
Хук-фасады (`useFavorites`, `useTheme`, …) удаляются. `useAtom`/`useAction` — только там, где
компонент обязан остаться обычным. Прямой вызов атома в обычном компоненте запрещён.

**2. Persist — штатный `withLocalStorage`.** Атом расширяется
`withLocalStorage(persistOptions(...))`; хелпер `persistOptions` задаёт три вещи, которые нельзя
оставлять дефолтными: ключ, `time` «навсегда» и валидацию Zod `safeParse` в `fromSnapshot` (а не
опцию `schema`). Конверт, кэш, кросс-таб синхронизация и переход на память — штатные.
Осознанный отказ от поведения `main`: сигнала о неудавшейся записи больше нет. Сбой `setItem`
проглатывается внутри Reatom (`console.warn`), атом обновляется в памяти. Поэтому событие
`favorite added` больше не зависит от успеха записи, `/profile` не показывает сообщение «не удалось
сохранить», а отчёт о сбое хранилища в Sentry (`setStorageErrorReporter`) удаляется.

**3. Данные — по статусу, без Suspense; кэш только на action-запросах.** Запрос к API —
`action + withAsync + withQueryCache`. Читающий ресурс — `computed(async) + withAsyncData({ status: true })`
без кэша, вызывает action через `await wrap(fetchX(params))`. Компонент читает `status()` и рисует
состояние через презентационный `AsyncContent`. Suspense остаётся только для ленивых чанков страниц.
Данные, зависящие от параметра пути, — в loader роута; остальное — в `computed` слайса-владельца.
Принятое изменение поведения: 20-секундного кэша ошибок больше нет. Ресурс без зависимостей после
ошибки не перезапрашивается до `retry()`; loader при повторном заходе на упавший роут шлёт один
новый запрос.

**4. URL-состояние `/search` — чтение через `computed`, запись одним вызовом.** Состояние
выводится из `urlAtom()` существующими чистыми функциями `lib/searchParams.ts`. Каждая мутация —
один `urlAtom.set(url => next, true)` в action `updateSearchUrl(mutator)`; сброс страницы и зачистка
фильтров происходят в том же вызове, не реактивно. `withSearchParams` не используется (см. Context).

**5. Роуты — один файл `src/app/routes.tsx`.** Pathless layout-роут рендерит `AppLayout` с
`outlet()`, страницы — дочерние роуты с `render`, возвращающим ленивую страницу. Файл лежит в `app`,
потому что `render` импортирует страницы, а loaders — сущности. Нижние слои ссылаются через
строители путей `@shared/config` и обычные `<a href>`; программная навигация — `urlAtom.go(...)`.
Новое поведение: неизвестный путь показывает страницу `NotFound` (сейчас catch-all роута нет).

**6. Порядок — послойно без моста.** client state → async без зависимости от URL → подготовка
(хелпер тестов, строители путей, модели URL) → замена роутера одним шагом → скролл, loaders, Sentry,
бюджеты.

## Technical Details

**Persist (`src/shared/lib/persist/`)**

```ts
// Number.MAX_SAFE_INTEGER, а не дефолт: в 1001.3.0 дефолт — ~24,8 дня.
export const PERSIST_FOREVER_MS = Number.MAX_SAFE_INTEGER

export const favoriteIds = reatomSet<number>([], 'favorites.ids').extend(
  withLocalStorage(
    persistOptions(
      'kinoshka:favorites',
      z.array(z.number()),
      new Set(),
      ids => new Set(ids),
    ),
  ),
)
```

- `persistOptions(key, schema, fallback, fromValid?)` → `{ key, time: PERSIST_FOREVER_MS, fromSnapshot }`;
  невалидный снапшот даёт `fallback`.

**Модели client state**

| Слайс     | Модель                                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| favorites | `favoriteIds` (`reatomSet`), `toggleFavorite` (action: toggle + `trackEvent` при добавлении)                                                                                                |
| watched   | `watchedIds` (`reatomSet`) — без обёрток, компоненты зовут `watchedIds.toggle(id)`                                                                                                          |
| watchlist | `watchlistIds` (`reatomSet`) — аналогично                                                                                                                                                   |
| theme     | `theme` (`reatomEnum`, initState `'system'`), `prefersDark` (`reatomMediaQuery`), `resolvedTheme` (computed), `toggleTheme`, `initThemeSync` (action, создаёт `effect` записи `data-theme`) |
| profile   | `profileName` (atom), `profileInitials` (computed), `setProfileName` (action: нормализация + запись); очистка — `profileName.set('')`                                                       |

`effect` темы создаётся в action инициализации: модульный `effect` не переживает `context.reset()`.

**Async**

```ts
// @shared/lib — единая политика кэша под квоту API; только для action
export const withQueryCache = (options = {}) =>
  withCache({ swr: false, staleTime: QUERY_STALE_MS, withPersist: devSessionPersist, ...options })

// @entities/movie — запрос с кэшем
export const fetchMovies = action(async (params: MoviesParams) => { … }, 'movie.fetchList').extend(
  withAsync(),
  withQueryCache({ length: 20, ignoreAbort: true }),
)

// ресурс без кэша поверх кэшируемого запроса
export const topRatedMovies = computed(
  async () => await wrap(fetchMovies(TOP_RATED_PARAMS)),
  'movie.topRated',
).extend(withAsyncData({ initState: [], status: true }))
```

- `devSessionPersist` — `withSessionStorage` только при `import.meta.env.MODE === 'development'`.
- `reatomMoviesByIds(ids, name)` (`@entities/movie`) — фабрика `computed + withAsyncData` поверх
  `fetchMovieDetail`; частичные отказы и 404 обрабатываются как сейчас.
- `AsyncContent` (`@shared/ui`) — без импорта Reatom: пропсы `pending`, `error`, `onRetry`,
  `fallback`, `errorFallback`, `children`.
- Скелетон списков — по `status().isFirstPending`; обновление поверх старых данных —
  `isPending && !isFirstPending`. Скелетон детальных страниц — по `!ready()`.
- `RouteLoader<Payload>` — алиас в `@shared/lib` поверх экспортируемого типа ядра; им типизируется
  проп `loader` у страниц.

**URL-состояние `/search` (`src/features/catalog-filter/model/searchState.ts`)**

```ts
const searchParams = computed(
  () =>
    urlAtom().pathname === paths.search()
      ? urlAtom().searchParams
      : EMPTY_PARAMS,
  'catalogFilter.searchParams',
)
export const filters = computed(
  () => getFilterFromSearchParams(searchParams()),
  'catalogFilter.filters',
)

const updateSearchUrl = action(
  (mutator: (params: URLSearchParams) => URLSearchParams) => {
    urlAtom.set(
      url => withSearch(url, mutator(new URLSearchParams(url.search))),
      true,
    )
  },
  'catalogFilter.updateUrl',
)

// Черновик инпута: следует за URL, но принимает прямую запись.
export const searchDraft = atom('', 'catalogFilter.draft').extend(
  withComputed(state => {
    ifChanged(searchQuery, query => {
      state = query
    })
    return state
  }),
)
```

- Чтение: `searchQuery`, `sort`, `page` (ограничение 1–10), `filters`, `activeChips`, `catalogParams`.
- Запись (каждая — один вызов `updateSearchUrl`): `setFilters`, `toggleGenre`, `resetFilters`,
  `setSort` — со сбросом страницы в 1; `goToPage`; `submitSearchQuery(raw)` — trim, порог
  `QUERY_MIN_LENGTH`, при входе в текстовый режим убирает фильтры и сортировку;
  `normalizeSearchUrl` — зачистка фильтров при deep-link в текстовый режим.
- `commitSearchDraft` — `action(async)` с `await wrap(sleep(QUERY_DEBOUNCE_MS))` и `withAbort()`.
- С другой страницы переход в поиск — один `urlAtom.go(paths.search({ q }))`.
- `catalog` (`pages/search/model`) — `computed(async) + withAsyncData({ status: true })` поверх
  `fetchSearchMovies` / `loadMoviesPage`. К его подключению (`withConnectHook`) привязаны
  `normalizeSearchUrl` и отслеживание `search submitted`.

**Роуты (`src/app/routes.tsx`)**

```tsx
export const layoutRoute = reatomRoute(
  {
    layout: true,
    render({ outlet }): RouteChild {
      return <AppLayout>{outlet()[0] ?? <NotFound />}</AppLayout>
    },
  },
  'routes.layout',
)

export const movieRoute = layoutRoute.reatomRoute(
  {
    path: 'movie/:id',
    loader: ({ id }) => loadMovieDetailBundle(id),
    render: (self): RouteChild => page(<MoviePage loader={self.loader} />),
  },
  'routes.movie',
)
```

- `page(node)` оборачивает ленивую страницу в `<Suspense fallback={<Spinner />}>`.
- Невалидный `:id` не снимает матч роута: loader бросает `ApiError` со статусом 404.
- `RouteChild` расширяется в отдельном модуле `src/app/reatom.d.ts` (с `import type`, иначе
  объявление затенит типы пакета); это второе исключение из правила `type`, не `interface`.
- `@shared/config/paths.ts` — строители путей; тест в `app` сверяет их с `route.path()`.

Замены API React Router:

| Было                      | Стало                                                         |
| ------------------------- | ------------------------------------------------------------- |
| `<Link to>`               | `<a href={paths.…}>`                                          |
| `<NavLink>`               | `<a>` + класс активности по `route.match()` / `route.exact()` |
| `navigate(path)`          | `urlAtom.go(path)`                                            |
| `navigate(-1)`            | `history.back()`                                              |
| `useMatch`, `useLocation` | `route.match()`, `urlAtom()` в `reatomComponent`              |
| `useParams`               | параметр из loader / проп из `render`                         |
| `useSearchParams`         | модель `searchState`                                          |
| `<ScrollRestoration />`   | модель Task 15                                                |

## What Goes Where

- **Implementation Steps** — изменения кода, тестов и документации в этом репозитории.
- **Post-Completion** — ручные проверки и внешние действия.

## Implementation Steps

### Task 1: Установка Reatom, bootstrap и тестовая изоляция

**Model:** opus — задаёт тестовую обвязку и конвенцию компонентов, на которые опираются все задачи

**Files:**

- Modify: `package.json`, `vite.config.ts`, `src/main.tsx`, `src/test/setup.ts`
- Create: `src/app/reatom-setup.ts`
- Create: `src/test/persist.ts`
- Create: `src/test/reatom.test.tsx`

- [ ] `pnpm add @reatom/core@1001.3.0 @reatom/react@1001.0.1`, `pnpm add -D @reatom/vite`
- [ ] подключить `reatom()` из `@reatom/vite` в `vite.config.ts`; если плагин несовместим с Vite 8/Rolldown — убрать зависимость и зафиксировать здесь ручной HMR-сниппет из handbook
- [ ] создать `src/app/reatom-setup.ts` (`connectLogger()` только при `MODE === 'development'`) и импортировать его в `src/main.tsx` сразу после `./app/sentry-bootstrap`
- [ ] в `src/test/setup.ts`: `afterEach` в порядке `cleanup()` → `urlAtom.init.abort()` → `context.reset()`; `sessionStorage.clear()`; URL возвращается на `/`
- [ ] создать `src/test/persist.ts` с `seedPersisted(key, data)` — пишет `PersistRecord` в `localStorage`
- [ ] тест: состояние атома не протекает между тестами
- [ ] тест: клик по `<a>` в двух тестах подряд даёт по одному `pushState` (слушатели `urlAtom` не копятся)
- [ ] тест: `reatomComponent` перерисовывается при изменении атома в сборке с React Compiler и в `StrictMode`
- [ ] тест: обработчик через `wrap(...)` обновляет атом; размонтирование не оставляет подписок
- [ ] тест: запрос через `apiClient` с сигналом из `abortVar` под MSW проходит и отменяется; если jsdom-`AbortSignal` несовместим с клиентом — зафиксировать здесь, что сигнал в клиент не передаётся
- [ ] запустить `make test`, `make typecheck`, `make lint` — зелёные перед Task 2

### Task 2: Хелпер `persistOptions`

**Model:** sonnet — хелпер задан планом, поведение persist фиксируется тестами

**Files:**

- Create: `src/shared/lib/persist/{index.ts,persistOptions.ts,persistOptions.test.ts}`
- Modify: `src/shared/lib/index.ts`

- [ ] `persistOptions.ts`: `PERSIST_FOREVER_MS` и `persistOptions(key, schema, fallback, fromValid?)`
- [ ] экспортировать из `@shared/lib`
- [ ] тесты (атом с `withLocalStorage(persistOptions(...))`): значение переживает пересоздание контекста; невалидный JSON, значение без конверта и снапшот, не прошедший схему, дают дефолт без исключения
- [ ] тесты: запись не истекает (проверка поля `to` в `localStorage`)
- [ ] тесты: `setItem` бросает → чтение и запись атома не бросают, значение обновлено в памяти
- [ ] тесты: `new StorageEvent('storage', { storageArea: localStorage, … })` обновляет подключённый атом
- [ ] запустить тесты — зелёные перед Task 3

### Task 3: Модель favorites

**Model:** sonnet — модель и API заданы планом, тесты покажут ошибку

**Files:**

- Create: `src/features/favorites/model/favorites.ts`, `src/features/favorites/model/favorites.test.ts`
- Modify: `src/features/favorites/index.ts`
- Delete: `src/features/favorites/model/{favoritesStorage,useFavorites}.ts` и их тесты
- Modify: потребители `useFavorites()` — `src/widgets/movie-rail/ui/MovieRail/MovieRail.tsx`, `src/pages/movie/ui/RelatedMovies/RelatedMovies.tsx`, `src/pages/search/ui/SearchResultsGrid/SearchResultsGrid.tsx`, страницы `favorites`, `popular`, `recommendations`, `watched`, `watchlist`, `profile`

- [ ] создать `favoriteIds` (`reatomSet` + `withLocalStorage`) и `toggleFavorite` (событие `favorite added` только при добавлении)
- [ ] перевести потребителей на `reatomComponent` и прямое чтение модели; `Card` продолжает получать `isFavorite`/`onToggleFavorite` пропсами
- [ ] `useFavoriteMovies` временно читает `favoriteIds` через `useAtom` (заменяется в Task 9)
- [ ] тесты модели: toggle/add/delete/clear, порядок вставки сохраняется, событие аналитики уходит при добавлении и не уходит при удалении
- [ ] обновить тесты потребителей: сидирование через `seedPersisted`
- [ ] запустить тесты — зелёные перед Task 4

### Task 4: Модели watched и watchlist

**Model:** sonnet — повтор паттерна Task 3

**Files:**

- Create: `src/features/watched/model/watched.ts`, `src/features/watchlist/model/watchlist.ts` и тесты
- Modify: `src/features/{watched,watchlist}/index.ts`, потребители `useWatched()` / `useWatchlist()`
- Delete: `src/features/{watched,watchlist}/model/{*Storage,useWatched,useWatchlist}.ts` и их тесты

- [ ] создать `watchedIds` и `watchlistIds` (`reatomSet` + `withLocalStorage`), без action-обёрток
- [ ] перевести потребителей на `reatomComponent`; независимость списков друг от друга и от favorites сохраняется (`user-lists.md`)
- [ ] `useWatchedMovies` / `useWatchlistMovies` временно читают атомы через `useAtom` (до Task 9)
- [ ] тесты моделей: toggle, персист, независимость трёх списков
- [ ] обновить тесты потребителей на `seedPersisted`
- [ ] запустить тесты — зелёные перед Task 5

### Task 5: Модель theme и inline-скрипт

**Model:** sonnet — модель задана планом; CSP-хэш проверяет существующий тест

**Files:**

- Create: `src/features/theme/model/theme.ts`, `src/features/theme/model/theme.test.ts`
- Modify: `src/features/theme/index.ts`, `src/features/theme/ui/ThemeToggle/ThemeToggle.tsx`, `src/app/reatom-setup.ts`
- Modify: `index.html`, `vercel.json`, тест заголовков
- Delete: `src/features/theme/model/{themeStorage,useTheme}.ts` и их тесты

- [ ] создать `theme`, `prefersDark`, `resolvedTheme`, `toggleTheme`, `initThemeSync`; `resolveTheme` из `lib/` переиспользуется
- [ ] вызвать `initThemeSync()` в `src/app/reatom-setup.ts`
- [ ] `ThemeToggle` → `reatomComponent`
- [ ] inline-скрипт в `index.html`: читать `data` из конверта `PersistRecord`, при любом сбое — прежний fallback на системную тему
- [ ] пересчитать sha256 скрипта в CSP (`vercel.json`) по инструкции `csp.md`
- [ ] тесты: `resolvedTheme` для трёх значений × системной темы; смена media query; `data-theme` обновляется после `initThemeSync`; персист и кросс-таб
- [ ] тест inline-скрипта на конверте и на мусоре в хранилище
- [ ] запустить тесты — зелёные перед Task 6

### Task 6: Модель profile

**Model:** sonnet — модель задана планом, нормализация уже покрыта тестами

**Files:**

- Create: `src/features/profile/model/profile.ts`, `src/features/profile/model/profile.test.ts`
- Modify: `src/features/profile/index.ts`, `src/features/profile/ui/ProfileAvatar/ProfileAvatar.tsx`, `src/pages/profile/ui/Profile/Profile.tsx`
- Delete: `src/features/profile/model/{profileStorage,useProfile}.ts` и их тесты

- [ ] создать `profileName`, `profileInitials`, `setProfileName`; `normalizeProfileName`, `PROFILE_NAME_MAX_LENGTH` и схема переезжают в `profile.ts`
- [ ] `Profile.tsx`: убрать ветку «не удалось сохранить» и её тесты; очистка имени — `profileName.set('')`
- [ ] `ProfileAvatar` и `Profile` → `reatomComponent`; правило про пользовательский текст в `aria-label` (`sentry.md`) не нарушать
- [ ] тесты: нормализация при записи, значение мимо UI (длинное, невидимое, с пробелами) даёт `''`, инициалы пересчитываются
- [ ] запустить тесты — зелёные перед Task 7

### Task 7: Async-фундамент — политика кэша, `AsyncContent`, запросы фильма по id

**Model:** opus — контракт слоя данных и поведение под квотой API, на него опираются Task 8–16

**Files:**

- Create: `src/shared/lib/query/{index.ts,withQueryCache.ts,withQueryCache.test.ts}`
- Create: `src/shared/ui/AsyncContent/{index.tsx,AsyncContent.test.tsx}`
- Create: `src/entities/movie/model/{movieDetail.ts,moviesByIds.ts}` и тесты
- Modify: `src/shared/lib/index.ts`, `src/shared/ui/index.ts`, `src/entities/movie/index.ts`

- [ ] `withQueryCache`, `devSessionPersist` и тип `RouteLoader<Payload>` в `@shared/lib`
- [ ] `AsyncContent` в `@shared/ui` (защита retry от двойного клика переносится из `AsyncBoundary`)
- [ ] `fetchMovieDetail`, `fetchMovieImages` — `action + withAsync + withQueryCache({ length: 100, ignoreAbort: true })`
- [ ] `loadMovieDetailBundle(id)` — деталь обязательна, картинки допускают отказ (как `combineDetail`)
- [ ] `reatomMoviesByIds(ids, name)` — логика частичных отказов и 404 из `getMoviesByIds`
- [ ] тесты: повторный вызов action с тем же id не шлёт запрос; параллельные вызовы делят один запрос; запись сверх `length` вытесняется; отклонённый результат не кэшируется
- [ ] тесты: `computed`-ресурс без зависимостей после ошибки не перезапрашивается при отписке и новой подписке, только по `retry()`
- [ ] тесты `AsyncContent`: pending, ошибка с retry, контент, пользовательский `errorFallback`
- [ ] запустить тесты — зелёные перед Task 8

### Task 8: Ресурсы главной и `/popular`

**Model:** sonnet — паттерн задан Task 7

**Files:**

- Create: `src/entities/movie/model/{rails.ts,rails.test.ts}`
- Modify: `src/entities/movie/index.ts`, `src/pages/home/ui/{PersonalRails,TopAnimeRails,TrandingSeriesRail,PopularMoviesRail}/*.tsx`, `src/pages/popular/ui/Popular/Popular.tsx`
- Delete: `src/entities/movie/hooks/{useTopRatedMovies,useNewMovies,usePopularMovies}.ts`, `src/entities/movie/api/{getMovies,getPopularMovies}.ts` и их тесты

- [ ] запросы `fetchMovies`, `fetchPopularMovies` — `action + withAsync + withQueryCache`; у `fetchPopularMovies` `staleTime` 24 часа
- [ ] ресурсы `topRatedMovies`, `topRatedAnime`, `newSeries`, `popularMovies` — `computed(async) + withAsyncData({ initState: [], status: true })` поверх запросов
- [ ] рейлы и `Popular` → `reatomComponent` + `AsyncContent`; retry — `resource.retry`; пустой результат — прежний `EmptyState`
- [ ] тесты моделей: параметры запроса, маппинг, ошибка 403 → `error()`; два ресурса с одинаковыми параметрами делят запрос
- [ ] обновить тесты страниц: скелетон, контент, ошибка с retry
- [ ] запустить тесты — зелёные перед Task 9

### Task 9: Списки по id, страницы каталога и рекомендации

**Model:** opus — кэш обхода курсоров: ошибка в ключах кэша тратит квоту и проходит собственные тесты

**Files:**

- Modify: `src/features/{favorites,watched,watchlist}/model/*.ts`, их `index.ts`
- Create: `src/entities/movie/model/{catalogPage.ts,catalogPage.test.ts}`
- Create: `src/pages/recommendations/model/{recommendations.ts,recommendations.test.ts}`
- Modify: `src/entities/movie/index.ts`, `src/pages/{favorites,watched,watchlist,recommendations}/ui/**`
- Delete: `src/features/*/model/use*Movies.ts`, `src/pages/recommendations/model/useRecommendedMovies.ts`, `src/entities/movie/api/getMoviesByIds.ts` и их тесты

- [ ] добавить `favoriteMovies`, `watchedMovies`, `watchlistMovies` через `reatomMoviesByIds`
- [ ] `catalogPage.ts`: `fetchCursorStep` — `action + withAsync + withQueryCache({ length: 50, ignoreAbort: true })`; `loadMoviesPage(params, page)` — обычная async-функция обхода курсоров с `wrap` на каждом шаге (логика `walkToPage`)
- [ ] старый `getMoviesPage` остаётся для `useMovieCatalog` до Task 14
- [ ] `recommendationQuery` (`computed` поверх `favoriteMovies.data()` и `computeRecommendationQuery`) и `recommendedMovies` (`computed(async) + withAsyncData`, `null` при пустом запросе)
- [ ] страницы → `reatomComponent` + `AsyncContent`; пустые состояния без изменений
- [ ] тесты: переключение избранного на `/favorites` не шлёт запросов за уже загруженными фильмами; 404 одного id не роняет список
- [ ] тесты `catalogPage`: страница N после страницы N−1 шлёт один запрос; повтор той же страницы — ни одного; обрыв курсора даёт пустую страницу
- [ ] тесты: `recommendationQuery` пересчитывается только при изменении избранного; пустое избранное → empty-state
- [ ] запустить тесты — зелёные перед Task 10

### Task 10: Словари жанров и стран, удаление `createStorageSlot`

**Model:** sonnet — схема кэша и persist расписана планом, удаление проверяется сборкой и knip

**Files:**

- Create: `src/entities/movie/model/{dictionaries.ts,dictionaries.test.ts}`
- Modify: `src/entities/movie/index.ts`, `src/features/catalog-filter/ui/{GenreSelector,CountrySelector}/*.tsx`, `src/test/setup.ts`, `src/app/sentry.ts`, `src/app/sentry.test.ts`
- Delete: `src/entities/movie/api/{createDictionaryCache,genreDictionaryCache,countryDictionaryCache}.ts`, `src/entities/movie/hooks/{useGenreDictionary,useCountryDictionary}.ts`, `src/shared/lib/storage/` и их тесты

- [ ] запросы `fetchGenreNames`, `fetchCountryNames` — `action + withAsync + withCache({ swr: false, staleTime: 7 дней, withPersist })`
- [ ] `withPersist: options => withLocalStorage({ ...options, key: 'kinoshka:genres', fromSnapshot })`, где `fromSnapshot` проверяет снапшот Zod-схемой и при невалидном возвращает текущее состояние, иначе делегирует `options.fromSnapshot`; для стран — `kinoshka:countries`
- [ ] ресурсы `genreDictionary`, `countryDictionary` — `computed(async) + withAsyncData({ initState: [] })`; `genres`, `countries` — `computed` с подстановкой `STATIC_FALLBACK_*` при пустых данных и при ошибке
- [ ] селекторы → `reatomComponent`
- [ ] убрать из `src/test/setup.ts` `resetGenreDictionaryState` / `resetCountryDictionaryState`
- [ ] удалить `src/shared/lib/storage/` и экспорты из `@shared/lib`; удалить из `src/app/sentry.ts` репортер сбоев хранилища (`setStorageErrorReporter`) и его тесты
- [ ] тесты: fallback до загрузки и при ошибке; словарь из хранилища не шлёт запрос после пересоздания контекста; запись старше 7 дней перезапрашивается; мусор в хранилище не роняет чтение
- [ ] запустить тесты и `make knip` — зелёные перед Task 11

### Task 11: Хелпер `renderWithRouter` и перевод тестов на него

**Model:** sonnet — механический рефакторинг 32 файлов, ошибки ловят сами тесты

**Files:**

- Create: `src/test/router.tsx`
- Modify: 32 тестовых файла с `MemoryRouter` / `createMemoryRouter`

- [ ] создать `renderWithRouter(ui, { url })` — пока обёртка над `MemoryRouter`; возвращает `getUrl()` (pathname + search)
- [ ] перевести все тесты с `MemoryRouter` на хелпер; проверки URL — через `getUrl()` внутри `waitFor`, а не `useLocation`-пробники
- [ ] тесты с `createMemoryRouter` и собственной конфигурацией роутов (`router.test.tsx`, тесты `AppLayout`) пометить комментарием — переписываются в Task 14
- [ ] запустить тесты — зелёные перед Task 12

### Task 12: Строители путей `paths`

**Model:** sonnet — механическая замена литералов путей, ещё на React Router

**Files:**

- Create: `src/shared/config/{paths.ts,paths.test.ts}`
- Modify: `src/shared/config/index.ts`, прод-файлы с литералами путей в `to=` / `navigate(...)`

- [ ] `paths.ts`: строители для всех десяти роутов; `paths.search(params?)` принимает `Record<string, string>` или `URLSearchParams` — сериализацию фильтров (`filtersToSearchParams`) делает вызывающий слой, `shared` о фильтрах не знает
- [ ] перевести все `to=` и `navigate(...)` на `paths.*`
- [ ] тесты строителей: кодирование id, пустые и непустые параметры поиска
- [ ] запустить тесты — зелёные перед Task 13

### Task 13: Модели URL-состояния `/search`

**Model:** opus — семантика записи в URL и сбросов; ошибки здесь тонкие и проходят простые проверки

**Files:**

- Create: `src/features/catalog-filter/model/{searchState.ts,searchState.test.ts}`
- Create: `src/entities/movie/model/{searchMovies.ts,searchMovies.test.ts}`
- Create: `src/pages/search/model/{catalog.ts,catalog.test.ts}`
- Modify: `src/features/catalog-filter/index.ts`, `src/features/catalog-filter/lib/searchParams.ts`, `src/entities/movie/index.ts`

- [ ] `searchState.ts`: чтение и запись по Technical Details; `resetPageToOne` переезжает из `usePageSync.ts` в `lib/searchParams.ts`; `QUERY_MIN_LENGTH` и `QUERY_DEBOUNCE_MS` переезжают сюда из `@widgets/header`
- [ ] событие `filter changed` — в actions фильтров, как сейчас
- [ ] `searchMovies.ts`: `fetchSearchMovies` — `action + withAsync + withQueryCache()`
- [ ] `catalog.ts`: `catalog`; к его подключению привязаны `normalizeSearchUrl` и отслеживание `search submitted` (`sleep(800)` + `withAbort`, без повторов для того же запроса)
- [ ] модели пока не подключены к UI; в тестах атомы подписаны, URL выставляется через `urlAtom`
- [ ] тесты (проверяется URL): deep-link `/search?q=…&page=3&genres=…` — страница сохраняется, фильтры и сортировка вычищены
- [ ] тесты: `setFilters` / `toggleGenre` / `resetFilters` / `setSort` сбрасывают `page`; `submitSearchQuery` из режима фильтров оставляет в URL только `q`; каждая мутация — один `replaceState`
- [ ] тесты: мусор в параметрах даёт дефолты; вне `/search` состояние пустое; запрос короче порога не пишется в `?q`
- [ ] тесты: `searchDraft` принимает ввод и следует за URL при back/forward; быстрый ввод даёт одну запись после debounce
- [ ] тесты `catalog`: режим поиска против режима каталога; возврат на уже загруженную страницу не шлёт запрос; старые данные остаются во время обновления
- [ ] запустить тесты — зелёные перед Task 14

### Task 14: Замена React Router на `reatomRoute`

**Model:** opus — меняет поведение, общее для всех страниц и виджетов; должно остаться согласованным

**Files:**

- Create: `src/app/routes.tsx`, `src/app/routes.test.tsx`, `src/app/reatom.d.ts`, `src/app/ui/NotFound/index.tsx`
- Modify: `src/app/providers.tsx`, `src/app/layouts/AppLayout.tsx`, `src/app/sentry.ts`, `src/app/sentry.test.ts`, `src/test/router.tsx`
- Modify: остальные прод-файлы с импортом `react-router` (список — `grep -rl react-router src`), включая `BottomNav`, `MobileHeader`, `Card`, `ProfileAvatar`
- Modify: `src/pages/search/ui/**`, `src/widgets/header/ui/Header/Header.tsx`, `src/pages/home/ui/HeroSection/HeroSection.tsx`
- Delete: `src/app/router.tsx`, `src/features/catalog-filter/model/useFilterState.ts`, `src/pages/search/model/{useMovieCatalog,usePageSync,useCatalogUpdateStatus,useSearchAnalytics}.ts`, `src/entities/movie/api/{getMoviesPage,getSearchMovies}.ts` и их тесты
- Modify: `package.json` (удалить `react-router`)

- [ ] `routes.tsx`: `layoutRoute` и дочерние роуты с `render`; страницы остаются ленивыми через `lazyNamed`; `RouteChild` — в `src/app/reatom.d.ts` с `oxlint-disable-next-line`
- [ ] `AppLayout` → `reatomComponent` с `children`: chrome выбирается по `route.exact()` / `route.match()`, `activeNav` для `/search` — из `filters().type`; `key` у `ErrorBoundary` — `urlAtom().pathname`; `trackPageview` по смене `pathname`
- [ ] `providers.tsx` рендерит `layoutRoute.render()` внутри `GlobalErrorBoundary`
- [ ] применить таблицу замен API React Router из Technical Details во всех прод-файлах
- [ ] `/movie/:id` и `/person/:id`: id приходит пропом из `render` (данные пока через прежние хуки и `AsyncBoundary` — до Task 16)
- [ ] `Search`, `ActiveFilterChips`, `FilterPanel`, `SearchResultsGrid` → модели Task 13; скелетон по `isFirstPending`, бейдж «Updating…» при обновлении поверх старых данных
- [ ] `Header` → `searchDraft` / `commitSearchDraft`; `HeroSection` → один `urlAtom.go(paths.search({ q }))`
- [ ] `sentry.ts`: заменить `reactRouterBrowserTracingIntegration` на `browserTracingIntegration()` без хуков роутера (имена по шаблону роута — Task 17)
- [ ] `renderWithRouter`: выставляет URL через `history.replaceState`, рендерит без провайдера роутера; `getUrl()` читает `urlAtom()`
- [ ] `routes.test.tsx`: каждый путь рендерит свою страницу; неизвестный путь → `NotFound`; `paths.*` совпадают с `route.path()`; клик по `<a>` меняет страницу без перезагрузки; `history.back()` возвращает предыдущую
- [ ] переписать помеченные в Task 11 тесты (`router.test.tsx`, тесты `AppLayout`) под новые роуты
- [ ] удалить `react-router` из зависимостей; `grep -r react-router src` пуст
- [ ] ⚠️ до Task 15 скролл при навигации не сбрасывается — известный разрыв между задачами
- [ ] запустить `make test`, `make typecheck`, `make lint` — зелёные перед Task 15

### Task 15: Восстановление скролла

**Model:** opus — порядок событий истории и момента отрисовки; ошибка не ловится простыми проверками

**Files:**

- Create: `src/app/model/{scrollRestoration.ts,scrollRestoration.test.ts}`
- Modify: `src/app/reatom-setup.ts`, `src/test/setup.ts`

- [ ] `urlAtom.sync` не заменять: модель слушает `urlAtom`; перед сменой сохраняет позицию под `history.state?.key`; после навигации (после `setTimeout(0)`) проставляет ключ новой записи через `history.replaceState({ ...history.state, key }, '')`
- [ ] позиции — в `sessionStorage`; новая запись истории со сменой `pathname` → скролл в начало; `popstate` → восстановление позиции по ключу из `history.state` после готовности данных роута
- [ ] смена только query-параметров (`replace` на `/search`) скролл не трогает; `history.scrollRestoration = 'manual'`
- [ ] запуск модели — action инициализации в `src/app/reatom-setup.ts`; модульное состояние сбрасывается в `afterEach`
- [ ] тесты: переход кликом по `<a>` сбрасывает скролл; переход через `urlAtom.go` — тоже; back восстанавливает; смена `?q` не скроллит
- [ ] запустить тесты — зелёные перед Task 16

### Task 16: Loaders для `/movie/:id` и `/person/:id`, удаление старого слоя запросов

**Model:** sonnet — паттерн loader и `AsyncContent` задан; удаление проверяется сборкой и knip

**Files:**

- Modify: `src/app/routes.tsx`, `src/pages/movie/MoviePage.tsx`, `src/pages/person/PersonPage.tsx`, `src/pages/movie/ui/**`
- Create: `src/entities/person/model/{personDetail.ts,personDetail.test.ts}`
- Modify: `src/entities/{movie,person}/index.ts`, `src/shared/lib/index.ts`, `src/shared/ui/index.ts`, `src/test/setup.ts`
- Delete: `src/entities/movie/hooks/`, `src/entities/person/hooks/`, оставшиеся `src/entities/*/api/get*.ts`, `src/shared/lib/{cachedFetcher,sessionCache}/`, `src/shared/ui/AsyncBoundary/` и их тесты

- [ ] `movieRoute`: loader вызывает `loadMovieDetailBundle`; невалидный id → `ApiError` со статусом 404
- [ ] `personRoute`: loader поверх `fetchPersonDetail` (`action + withAsync + withQueryCache({ length: 50, ignoreAbort: true })`)
- [ ] `MoviePage` / `PersonPage` → `reatomComponent`, проп `loader: RouteLoader<…>`; скелетон при `!ready()`, различение 404 и прочих ошибок, retry — `loader.retry`
- [ ] удалить `createCachedFetcher`, `sessionCache`, `AsyncBoundary`, `resetAllCachedFetchers` из `setup.ts`
- [ ] тесты: `/movie/1 → /movie/2` показывает скелетон, а не фильм 1; `/movie/abc` и 404 API → «Movie not found»; отказ картинок не ломает страницу
- [ ] тесты: возврат на уже открытый фильм не шлёт запрос; повторный заход на упавший роут шлёт ровно один запрос
- [ ] запустить тесты и `make knip` — зелёные перед Task 17

### Task 17: Sentry-трейсинг роутов

**Model:** sonnet — правило именования задано, проверяется unit-тестом с моком Sentry

**Files:**

- Modify: `src/app/sentry.ts`, `src/app/sentry-bootstrap.ts`, `src/main.tsx`, их тесты
- Create: `src/app/model/{routeTracing.ts,routeTracing.test.ts}`

- [ ] выключить авто-спаны pageload/navigation у `browserTracingIntegration`
- [ ] `routeTracing.ts`: pageload-спан при старте и navigation-спан при смене точного роута; имя — `pattern` роута (`/movie/:id`), источник `route`; неизвестный путь — отдельное фиксированное имя
- [ ] обновить WHY-комментарии про порядок импортов в `main.tsx` / `sentry-bootstrap.ts`: требование «до создания роутера» заменяется на «до `reatom-setup`»
- [ ] тесты: `/movie/1` и `/movie/2` дают одно имя транзакции; смена query-параметров спан не создаёт
- [ ] существующие тесты PII-скраббинга и `captureRouteError` остаются зелёными
- [ ] запустить тесты — зелёные перед Task 18

### Task 18: Бюджеты бандла, code splitting, knip

**Model:** sonnet — измерить и зафиксировать, проверки автоматические

**Files:**

- Modify: `package.json` (`size-limit`), `vite.config.ts`, `knip.jsonc`, `bundle.config.ts` при необходимости

- [ ] `make build-only` и `make analyze`: убедиться, что страницы остались отдельными чанками, а `routes.tsx` не втянул их в entry
- [ ] выставить бюджеты `size-limit` по факту с прежним запасом; записать дельты `vendor`/`shared`/`entry` относительно `main` в раздел Progress Tracking этого файла
- [ ] `make knip` — чисто; убрать устаревшие исключения
- [ ] `make check` и `make size` — зелёные перед Task 19

### Task 19: Проверка критериев приёмки

**Model:** sonnet — сверка результата с планом и устранение расхождений

**Files:**

- Modify: `e2e/*.spec.ts` — только при изменившемся наблюдаемом поведении

- [ ] все пункты таблицы соответствия 3.3 реализованы
- [ ] `grep -rE "react-router|createStorageSlot|createCachedFetcher|useSyncExternalStore" src` — пусто
- [ ] ни один обычный (не `reatomComponent`) компонент не вызывает атом напрямую — проверить поиском по импортам моделей
- [ ] ни на одном `computed` нет `withCache` / `withQueryCache`
- [ ] `useViewport()` по-прежнему имеет ровно двух потребителей
- [ ] `make check`, `make test`, `make knip`, `make size` — зелёные
- [ ] `make build-only && make e2e` — один прогон
- [ ] покрытие (`make coverage`) не ниже текущего уровня ветки

### Task 20: [Final] Документация

**Model:** sonnet — документация описывает уже построенное поведение

**Files:**

- Modify: `README.md`, `AGENTS.md`, `.claude/rules/*.md`, `plans/roadmap.md`
- Move: этот план → `docs/plans/completed/`

- [ ] `README.md`: раздел ветки — паттерны Reatom v1001, плюсы и минусы, дельта бандла из Task 18
- [ ] `AGENTS.md` (на английском): убрать gotcha про `createStorageSlot().set()`; стек, раздел Routing, API-слой, Data summary, Testing; второе исключение `interface` (`src/app/reatom.d.ts`); убрать упоминания удалённых хуков и `createStorageSlot`
- [ ] `.claude/rules/*.md` (на английском, только неочевидное): `storage.md` — TTL persist в 1001.3.0, почему не `schema`, отказ от сигнала о сбое записи; `sentry.md` — убрать раздел про репортер хранилища; `data-layer.md` — кэш только на action, отказ от кэша ошибок; `search-catalog.md` — одна запись в URL на мутацию, почему не `withSearchParams`; `ui-patterns.md` — ловушка React Compiler; `sentry.md` — ручные спаны; `e2e.md`/тесты — порядок изоляции; обновить `paths:` под новые файлы
- [ ] `plans/roadmap.md`: отметить чекбоксы 3.3 и дописать, что реализация — на v1001
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка**

- DevTools-консоль в dev: логи `connectLogger` показывают атомы и actions с осмысленными именами
  (критерий Phase 3 «DevTools видит state-tool артефакты»).
- Две вкладки: избранное, тема и профиль синхронизируются.
- Приватный режим браузера / заблокированные данные сайта: приложение работает, состояние живёт в
  памяти до перезагрузки.
- Навигация назад/вперёд между `/`, `/movie/:id`, `/search`: позиция скролла восстанавливается.
- Network в dev: перезагрузка страницы и возврат на уже открытую страницу каталога не шлют запросов.
- HMR при правке `src/app/routes.tsx` не оставляет устаревший outlet.

**Внешнее**

- После выхода версии `@reatom/core` с дефолтом `time = Number.MAX_SAFE_INTEGER` — обновить
  зависимость и убрать пояснение у `PERSIST_FOREVER_MS`.
- Найденные ловушки (`withCache` на `computed`, запись нескольких `withSearchParams`, дефолт
  `time` в persist) — кандидаты на issue в `reatom/reatom`.
- Сводная таблица сравнения state-библиотек (роадмап 3.8) заполняется на `main` отдельно.
- Lighthouse по лейблу `run-lighthouse` на PR ветки — сравнить Performance с `main`.
