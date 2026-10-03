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
| README ветки                                   | раздел в `README.md` — Task 22                                                                                             |

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
  в CSP (`csp.md`); 21 тестовый файл сидит `localStorage.setItem` в сыром формате; e2e-спеки
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
- **изоляция** — один `afterEach` в `src/test/setup.ts` с явным порядком (несколько отдельных
  `afterEach` Vitest выполняет в обратном порядке регистрации, порядок между ними неочевиден):
  `cleanup()` → `urlAtom.init.abort()` → `context.reset()` → `localStorage.clear()` /
  `sessionStorage.clear()` → `history.replaceState` на `/` → сброс модульного состояния вне атомов →
  `server.resetHandlers()`. Незавершённые запросы должны быть отменены до `resetHandlers()`, иначе
  запрос предыдущего теста попадёт в `onUnhandledRequest: 'error'` следующего.
- **компонентные**: Testing Library; URL задаётся и читается хелпером `renderWithRouter` (Task 11).
- **URL-состояние**: проверяется сам URL, а не только значение атома.
- **e2e (Playwright)**: спеки правятся только там, где меняется наблюдаемое поведение. Полный
  прогон — один раз в Task 21 (квота API 200 запросов/сутки).

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
опцию `schema`). Для не-JSON состояний (`Set`) хелпер принимает явный `toSnapshot`: сериализует ли
`reatomSet` себя сам, не проверено, а `JSON.stringify(new Set([1]))` даёт `{}`. Конверт, кэш,
кросс-таб синхронизация и переход на память — штатные.
Осознанный отказ от поведения `main`: сигнала о неудавшейся записи больше нет. Сбой `setItem`
проглатывается внутри Reatom (`console.warn`), атом обновляется в памяти. Поэтому событие
`favorite added` больше не зависит от успеха записи, `/profile` не показывает сообщение «не удалось
сохранить», а отчёт о сбое хранилища в Sentry (`setStorageErrorReporter`) удаляется. Следствия:
уходят CSS-класс `saveError` и его тесты в `Profile.test.tsx`, тесты репортера в
`src/app/sentry.test.ts`, правило `analytics.md` «`favorite added` только при успешной записи»; в
приватном режиме `console.warn` пишется на каждую запись.

**3. Данные — по статусу, без Suspense; кэш только на action-запросах.** Запрос к API —
`action + withAsync + withQueryCache`. Читающий ресурс — `computed(async) + withAsyncData({ status: true })`
без кэша, вызывает action через `await wrap(fetchX(params))`. Компонент читает `status()` и рисует
состояние через презентационный `AsyncContent`. Suspense остаётся только для ленивых чанков страниц.
Данные, зависящие от параметра пути, — в loader роута; остальное — в `computed` слайса-владельца.
Принятое изменение поведения: 20-секундного кэша ошибок больше нет. Ресурс без зависимостей после
ошибки не перезапрашивается до `retry()`; loader при повторном заходе на упавший роут шлёт один
новый запрос. Для словарей жанров и стран: пока идёт перезапрос устаревшего словаря, показывается
статический fallback (на `main` — устаревший словарь), а 60-секундный кулдаун после ошибки
заменяется на «без повтора до перезагрузки страницы».
Вызов `apiClient` и проверка `'statusCode' in response.data` (`data-layer.md`) переезжают в тело
action в сегменте `model/`; в `api/` остаются только мапперы и `paginationConfig`.

**4. URL-состояние `/search` — чтение через `computed`, запись одним вызовом.** Состояние
выводится из `urlAtom()` существующими чистыми функциями `lib/searchParams.ts`. Каждая мутация —
один `urlAtom.set(url => next, true)` в action `updateSearchUrl(mutator)`; сброс страницы и зачистка
фильтров происходят в том же вызове, не реактивно. `withSearchParams` не используется (см. Context).

**5. Роуты — один файл `src/app/routes.tsx`.** Pathless layout-роут рендерит `AppLayout` с
`outlet()`, страницы — дочерние роуты с `render`, возвращающим ленивую страницу. Файл лежит в `app`,
потому что `render` импортирует страницы, а loaders — сущности. Нижние слои ссылаются через
строители путей `@shared/config` и обычные `<a href>`; программная навигация — `urlAtom.go(...)`.
Новое поведение: неизвестный путь показывает страницу `NotFound` (сейчас catch-all роута нет).
`AppLayout` роуты не импортирует (иначе цикл `routes.tsx` ↔ `AppLayout.tsx`, `import/no-cycle` —
error): chrome и активный пункт навигации выбираются по `matchRoutePattern(urlAtom().pathname)` из
`@shared/config`. `route.match()` / `route.exact()` используются только внутри `routes.tsx`.
`layoutRoute.render()` вызывается в `reatomComponent` `RouterOutlet`, а не в обычном `Providers`.

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
    persistOptions({
      key: 'kinoshka:favorites',
      schema: z.array(z.number()),
      fallback: new Set(),
      fromValid: ids => new Set(ids),
      toSnapshot: ids => [...ids],
    }),
  ),
)
```

- `persistOptions({ key, schema, fallback, fromValid?, toSnapshot? })` →
  `{ key, time: PERSIST_FOREVER_MS, fromSnapshot, toSnapshot? }`; невалидный снапшот даёт `fallback`.
  `schema` описывает формат в хранилище (для `Set` — массив), `fromValid` / `toSnapshot` переводят
  его в состояние атома и обратно.

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
  `fetchMovieDetail`; `ids` — реактивный источник (атом или `computed` с набором id), а не массив;
  частичные отказы и 404 обрабатываются как сейчас.
- `AsyncContent` (`@shared/ui`) — без импорта Reatom: пропсы `pending`, `error`, `onRetry`,
  `fallback`, `errorFallback`, `children`.
- Скелетон списков — по `status().isFirstPending`; обновление поверх старых данных —
  `isPending && !isFirstPending`. Скелетон детальных страниц — по `!ready()`.
- `QUERY_STALE_MS` — 5 минут, как TTL `createCachedFetcher` на `main`.
- Проп `loader` у страниц типизируется экспортируемым типом ядра напрямую, без алиаса в `@shared`.
- Типы из удаляемых файлов переезжают к новым моделям: `CatalogParams`, `CatalogPageResult` →
  `model/catalogPage.ts`; `SearchMoviesResult` → `model/searchMovies.ts`; `MovieImage`,
  `MovieDetailBundle` → `model/movieDetail.ts`. Пока старый файл жив, он импортирует тип из нового
  места.

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
- `activeChips` — `computed` со списком `FilterChip = { id, label }` без замыканий; чип снимает action
  `removeFilterChip(id)`. Старый `ActiveChip` с `onRemove` живёт в `useFilterState.ts` до его удаления.
- `FilterState` и `TYPE_LABELS` переезжают в `model/types.ts` слайса.
- Запись (каждая — один вызов `updateSearchUrl`): `setFilters`, `toggleGenre`, `resetFilters`,
  `removeFilterChip` — со сбросом страницы в 1; `setSort` страницу не сбрасывает (как на `main`);
  `goToPage` — запись страницы и `window.scrollTo({ top: 0, behavior: 'smooth' })` (как на `main`);
  `submitSearchQuery(raw)` — trim, порог `QUERY_MIN_LENGTH`, при входе в текстовый режим убирает
  фильтры и сортировку; `normalizeSearchUrl` — зачистка фильтров в текстовом режиме.
- `commitSearchDraft` — `action(async)` с `await wrap(sleep(QUERY_DEBOUNCE_MS))` и `withAbort()`.
- С другой страницы переход в поиск — один `urlAtom.go(paths.search({ q }))`.
- `catalog` (`pages/search/model`) — `computed(async) + withAsyncData({ status: true })` поверх
  `fetchSearchMovies` / `loadMoviesPage`. В его connect-hook создаётся `effect`, живущий, пока
  `catalog` подключён: он реагирует на каждую смену URL — вызывает `normalizeSearchUrl` (в том числе
  при переходе на «грязный» URL без перемонтирования страницы) и отслеживает `search submitted` при
  каждой смене `q`. Сам connect-hook срабатывает один раз и для этого не годится.

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

// Обычный компонент здесь нельзя: React Compiler закэширует результат render().
export const RouterOutlet = reatomComponent(
  () => layoutRoute.render(),
  'RouterOutlet',
)
```

- `page(node)` оборачивает ленивую страницу в `<Suspense fallback={<Spinner />}>`.
- `MoviePage` сохраняет `key={id}` у `Movie` (сброс таба при смене фильма).
- Невалидный `:id` не снимает матч роута: loader бросает `ApiError` со статусом 404.
- `RouteChild` расширяется в отдельном модуле `src/app/reatom.d.ts` (с `import type`, иначе
  объявление затенит типы пакета); это второе исключение из правила `type`, не `interface`.
- `@shared/config/paths.ts` — строители путей, список шаблонов `ROUTE_PATTERNS` (`/movie/:id`, …) и
  чистая функция `matchRoutePattern(pathname)` → шаблон или `null`. Ею пользуются `AppLayout`
  (chrome), `ProfileAvatar` (`aria-current`) и Sentry (имя транзакции). Тест в `app` сверяет
  строители и шаблоны с `route.path()` / шаблонами роутов.

Замены API React Router:

| Было                          | Стало                                                                                                                                                            |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<Link to>`                   | `<a href={paths.…}>`                                                                                                                                             |
| `<NavLink>`                   | `<a>` + `aria-current='page'` по `urlAtom().pathname === paths.profile()` (единственный `NavLink` — `ProfileAvatar` в `features`, роуты из `app` там недоступны) |
| `navigate(path)`              | `urlAtom.go(path)`                                                                                                                                               |
| `navigate(path, { replace })` | `urlAtom.go(path, replace)` — `BottomNav` сохраняет `replace` при совпадении `pathname + search + hash` (`profile.md`)                                           |
| `navigate(-1)`                | `history.back()`                                                                                                                                                 |
| `useMatch`, `useLocation`     | `matchRoutePattern(urlAtom().pathname)`, `urlAtom()` в `reatomComponent`                                                                                         |
| `useParams`                   | параметр из loader / проп из `render`                                                                                                                            |
| `useSearchParams`             | модель `searchState`                                                                                                                                             |
| `<ScrollRestoration />`       | модель Task 17                                                                                                                                                   |

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
- ➕ Create: `src/test/reatomTestScope.ts`

- [x] `pnpm add @reatom/core@1001.3.0 @reatom/react@1001.0.1`, `pnpm add -D @reatom/vite` (точную версию закрепить в `package.json`); если установку блокирует минимальный возраст релиза — добавить пакеты в `minimumReleaseAgeExclude` в `pnpm-workspace.yaml` — блокировки не было, `@reatom/vite` закреплён как `1001.0.0`
- [x] подключить `reatom()` из `@reatom/vite` в `vite.config.ts`; если плагин несовместим с Vite 8/Rolldown — убрать зависимость и зафиксировать здесь ручной HMR-сниппет из handbook — совместим: плагин `apply: 'serve'`, тянет собственный `typescript@5.9` (проектный TS 7 не задевает)
- [x] создать `src/app/reatom-setup.ts` (`connectLogger()` только при `MODE === 'development'`) и импортировать его в `src/main.tsx` сразу после `./app/sentry-bootstrap`
- [x] в `src/test/setup.ts`: свести три существующих `afterEach` в один с порядком из Testing Strategy (`cleanup()` → `urlAtom.init.abort()` → `context.reset()` → очистка `localStorage` / `sessionStorage` → URL на `/` → `resetAllCachedFetchers()` и сброс словарей → `server.resetHandlers()`); между `urlAtom.init.abort()` и `context.reset()` добавлен `abortTestFrames()` (см. следующий пункт)
- [x] тест: значение persist-атома, записанное в одном тесте, не видно в следующем (после `localStorage.clear()` + `context.reset()`)
- [x] тест: незавершённый запрос одного теста не падает как unhandled request в следующем; если `context.reset()` запросы не отменяет — добавить в `afterEach` явную отмену и зафиксировать это здесь — ⚠️ **не отменяет**: проверка «context reset» в `wrap` сравнивает `root` кадра с самим собой, дочерние кадры держат старый root. Добавлен `src/test/reatomTestScope.ts`: глобальное расширение запоминает кадры всех атомов/actions теста, `abortTestFrames()` в `afterEach` их абортит. Модуль импортируется первым в `setup.ts` (расширение применяется только к атомам, созданным после регистрации). Проверено и для action вне компонента, и для `computed + withAsyncData` в размонтированном компоненте — размонтирование само запрос тоже не отменяет
- [x] тест: компонент с `use()` внутри `reatomComponent` приостанавливается и возобновляется под `Suspense`; если нет — зафиксировать здесь, что компоненты с `use()` до Task 8/9 остаются обычными с `useAtom` — работает; рендер с `use()` в тестах — внутри `await act(async () => render(...))`, как и для обычных компонентов
- [x] создать `src/test/persist.ts` с `seedPersisted(key, data)` — пишет `PersistRecord` в `localStorage`
- [x] тест: состояние атома не протекает между тестами
- [x] тест: клик по `<a>` в двух тестах подряд даёт по одному `pushState` (слушатели `urlAtom` не копятся)
- [x] тест: `reatomComponent` перерисовывается при изменении атома в сборке с React Compiler и в `StrictMode` — ⚠️ перерисовка асинхронная (уведомления в микротаске): синхронный `act(() => atom.set(...))` / `fireEvent` DOM не обновляет, в тестах нужен `await act(async () => ...)` или `findBy*`
- [x] тест: обработчик через `wrap(...)` обновляет атом; размонтирование не оставляет подписок
- [x] тест: запрос через `apiClient` с сигналом из `abortVar` под MSW проходит и отменяется; если jsdom-`AbortSignal` несовместим с клиентом — зафиксировать здесь, что сигнал в клиент не передаётся — сигнал передаётся через `config: { signal }` и отменяет запрос; ⚠️ клиент отклоняется нативным `DOMException` (в jsdom не `instanceof Error`), поэтому `isAbort()` из Reatom его не распознаёт — проверять по `name === 'AbortError'`
- [x] запустить `make test`, `make typecheck`, `make lint` — зелёные перед Task 2

### Task 2: Хелпер `persistOptions`

**Model:** sonnet — хелпер задан планом, поведение persist фиксируется тестами

**Files:**

- Create: `src/shared/lib/persist/{index.ts,persistOptions.ts,persistOptions.test.ts}`
- Modify: `src/shared/lib/index.ts`

- [x] `persistOptions.ts`: `PERSIST_FOREVER_MS` и `persistOptions({ key, schema, fallback, fromValid?, toSnapshot? })`
- [x] тесты: `reatomSet` с `toSnapshot` — в `localStorage` лежит конверт с массивом, после пересоздания контекста восстанавливается `Set` с тем же порядком; если `reatomSet` сериализуется сам и `toSnapshot` не нужен — убрать параметр и зафиксировать это здесь — `toSnapshot` нужен (в тесте `reatomSet` без него не восстанавливается из массива); оставлен
- [x] экспортировать из `@shared/lib`
- [x] тесты (атом с `withLocalStorage(persistOptions(...))`): значение переживает пересоздание контекста; невалидный JSON, значение без конверта и снапшот, не прошедший схему, дают дефолт без исключения
- [x] тесты: запись не истекает (проверка поля `to` в `localStorage`) — `to` = `Date.now() + time` (больше `Number.MAX_SAFE_INTEGER` из-за сложения), тест проверяет «дальше чем через год»
- [x] тесты: `setItem` бросает → чтение и запись атома не бросают, значение обновлено в памяти
- [x] тесты: `new StorageEvent('storage', { storageArea: localStorage, … })` обновляет подключённый атом — подписка на `storage` ставится в connect-hook асинхронно: перед `dispatchEvent` нужен `await` макротаска после `subscribe`
- [x] запустить тесты — зелёные перед Task 3

### Task 3: Модель favorites

**Model:** sonnet — модель и API заданы планом, тесты покажут ошибку

**Files:**

- Create: `src/features/favorites/model/favorites.ts`, `src/features/favorites/model/favorites.test.ts`
- Modify: `src/features/favorites/index.ts`
- Delete: `src/features/favorites/model/{favoritesStorage,useFavorites}.ts` и их тесты
- Modify: потребители `useFavorites()` — `src/widgets/movie-rail/ui/MovieRail/MovieRail.tsx`, `src/pages/movie/ui/RelatedMovies/RelatedMovies.tsx`, `src/pages/search/ui/SearchResultsGrid/SearchResultsGrid.tsx`, страницы `favorites`, `popular`, `recommendations`, `watched`, `watchlist`, `profile`

- [ ] создать `favoriteIds` (`reatomSet` + `withLocalStorage`) и `toggleFavorite` (событие `favorite added` только при добавлении)
- [ ] перевести потребителей на `reatomComponent` и прямое чтение модели; `Card` продолжает получать `isFavorite`/`onToggleFavorite` пропсами; компоненты, которые ещё вызывают `use()`, переводятся по результату теста из Task 1
- [ ] `useFavoriteMovies` временно читает `favoriteIds` через `useAtom` (заменяется в Task 9)
- [ ] тесты модели: toggle/add/delete/clear, порядок вставки сохраняется, событие аналитики уходит при добавлении и не уходит при удалении
- [ ] тест персиста: после `toggleFavorite` в `localStorage['kinoshka:favorites']` лежит конверт с массивом id; значение из `seedPersisted` читается при старте
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
- [ ] тесты моделей: toggle, персист (в `localStorage` — конверт с массивом id, восстановление из `seedPersisted`), независимость трёх списков
- [ ] обновить тесты потребителей на `seedPersisted`
- [ ] запустить тесты — зелёные перед Task 5

### Task 5: Модель theme и inline-скрипт

**Model:** sonnet — модель задана планом; CSP-хэш проверяет существующий тест

**Files:**

- Create: `src/features/theme/model/theme.ts`, `src/features/theme/model/theme.test.ts`
- Modify: `src/features/theme/index.ts`, `src/features/theme/ui/ThemeToggle/ThemeToggle.tsx`, `src/app/reatom-setup.ts`
- Modify: `src/pages/profile/ui/Profile/Profile.tsx` и `Profile.test.tsx` (второй потребитель `useTheme()`: `theme`, `setTheme`)
- Modify: `index.html`, `vercel.json`; `vercel-headers.test.ts` сам пересчитывает хэш из `index.html` и должен остаться зелёным без правок
- Delete: `src/features/theme/model/{themeStorage,useTheme}.ts` и их тесты

- [ ] создать `theme`, `prefersDark`, `resolvedTheme`, `toggleTheme`, `initThemeSync`; `resolveTheme` из `lib/` переиспользуется
- [ ] вызвать `initThemeSync()` в `src/app/reatom-setup.ts`
- [ ] `ThemeToggle` → `reatomComponent`; `Profile` читает `theme` и пишет `theme.set(...)` через `useAtom` (в `reatomComponent` он переводится в Task 6)
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
- [ ] `Profile.tsx`: убрать ветку «не удалось сохранить», CSS-класс `saveError` и их тесты; очистка имени — `profileName.set('')`
- [ ] `ProfileAvatar` и `Profile` → `reatomComponent`; правило про пользовательский текст в `aria-label` (`sentry.md`) не нарушать
- [ ] тесты: нормализация при записи, значение мимо UI (длинное, невидимое, с пробелами) даёт `''`, инициалы пересчитываются
- [ ] запустить тесты — зелёные перед Task 7

### Task 7: Async-фундамент — политика кэша, `AsyncContent`, запросы фильма по id

**Model:** opus — контракт слоя данных и поведение под квотой API, на него опираются Task 8–18

**Files:**

- Create: `src/shared/lib/query/{index.ts,withQueryCache.ts,withQueryCache.test.ts}`
- Create: `src/shared/ui/AsyncContent/{index.tsx,AsyncContent.test.tsx}`
- Create: `src/entities/movie/model/{movieDetail.ts,moviesByIds.ts}` и тесты
- Modify: `src/shared/lib/index.ts`, `src/shared/ui/index.ts`, `src/entities/movie/index.ts`

- [ ] `withQueryCache` (`QUERY_STALE_MS` — 5 минут) и `devSessionPersist` в `@shared/lib`
- [ ] `AsyncContent` в `@shared/ui` (защита retry от двойного клика переносится из `AsyncBoundary`)
- [ ] `fetchMovieDetail` — `action + withAsync + withQueryCache({ length: 100, ignoreAbort: true })`; вызов `apiClient` и проверка `'statusCode' in response.data` — в теле action (`fetchMovieImages` и `loadMovieDetailBundle` появляются в Task 18 вместе с потребителем, иначе knip в Task 10 красный)
- [ ] `reatomMoviesByIds(ids, name)` — `ids` реактивный источник; логика частичных отказов и 404 из `getMoviesByIds`; в баррель `@entities/movie` экспортируется в Task 9 вместе с первым потребителем
- [ ] тесты: повторный вызов action с тем же id не шлёт запрос; параллельные вызовы делят один запрос; запись сверх `length` вытесняется; отклонённый результат не кэшируется
- [ ] тесты: `computed`-ресурс без зависимостей после ошибки не перезапрашивается при отписке и новой подписке, только по `retry()`
- [ ] тесты `AsyncContent`: pending, ошибка с retry, контент, пользовательский `errorFallback`
- [ ] запустить тесты — зелёные перед Task 8

### Task 8: Ресурсы главной и `/popular`

**Model:** sonnet — паттерн задан Task 7

**Files:**

- Create: `src/entities/movie/model/{rails.ts,rails.test.ts}`
- Modify: `src/entities/movie/index.ts`, `src/entities/movie/hooks/index.ts`, `src/pages/home/ui/Home/Home.tsx` (четыре `AsyncBoundary` и три `invalidate*`), `src/pages/home/ui/{PersonalRails,TopAnimeRails,TrandingSeriesRail,PopularMoviesRail}/*.tsx`, `src/pages/popular/ui/Popular/Popular.tsx`
- Delete: `src/entities/movie/hooks/{useTopRatedMovies,useNewMovies,usePopularMovies}.ts`, `src/entities/movie/api/{getMovies,getPopularMovies}.ts` и их тесты

- [ ] запросы `fetchMovies`, `fetchPopularMovies` — `action + withAsync + withQueryCache`; у `fetchPopularMovies` `staleTime` 24 часа
- [ ] ресурсы `topRatedMovies`, `topRatedAnime`, `newSeries`, `popularMovies` — `computed(async) + withAsyncData({ initState: [], status: true })` поверх запросов
- [ ] рейлы и `Popular` → `reatomComponent` + `AsyncContent`; retry — `resource.retry` вместо `invalidate*`; пустой результат — прежний `EmptyState`; `fallback` рейлов остаётся `MovieRailSkeleton`, lazy-mount и `content-visibility` на рейле и скелетоне не меняются (`performance.md`)
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

Старый `getMoviesPage` остаётся для `useMovieCatalog` до Task 16.

- [ ] добавить `favoriteMovies`, `watchedMovies`, `watchlistMovies` через `reatomMoviesByIds`
- [ ] `catalogPage.ts`: `fetchCursorStep` — `action + withAsync + withQueryCache({ length: 50, ignoreAbort: true })`; `loadMoviesPage(params, page)` — обычная async-функция обхода курсоров с `wrap` на каждом шаге (логика `walkToPage`)
- [ ] типы `CatalogParams` и `CatalogPageResult` перенести в `catalogPage.ts`; `getMoviesPage.ts` и `computeRecommendationQuery.ts` импортируют их оттуда
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
- Delete: `src/entities/movie/api/{createDictionaryCache,genreDictionaryCache,countryDictionaryCache,getGenreDictionary,getCountryDictionary}.ts`, `src/entities/movie/hooks/{useGenreDictionary,useCountryDictionary}.ts`, `src/shared/lib/storage/` и их тесты

- [ ] запросы `fetchGenreNames`, `fetchCountryNames` — `action + withAsync + withCache({ swr: false, staleTime: 7 дней, withPersist })`; тела запросов из `getGenreDictionary.ts` / `getCountryDictionary.ts` переезжают в actions
- [ ] `withPersist: options => withLocalStorage({ ...options, key: 'kinoshka:genres', fromSnapshot })`, где `fromSnapshot` проверяет снапшот Zod-схемой и при невалидном возвращает текущее состояние, иначе делегирует `options.fromSnapshot`; для стран — `kinoshka:countries`
- [ ] ресурсы `genreDictionary`, `countryDictionary` — `computed(async) + withAsyncData({ initState: [] })`; `genres`, `countries` — `computed` с подстановкой `STATIC_FALLBACK_*` при пустых данных и при ошибке
- [ ] селекторы → `reatomComponent`
- [ ] убрать из `src/test/setup.ts` `resetGenreDictionaryState` / `resetCountryDictionaryState`
- [ ] удалить `src/shared/lib/storage/` и экспорты из `@shared/lib`; удалить из `src/app/sentry.ts` репортер сбоев хранилища (`setStorageErrorReporter`) и его тесты
- [ ] тесты изменённого поведения: во время перезапроса устаревшего словаря показывается статический fallback; после ошибки запрос не повторяется до пересоздания контекста
- [ ] тесты: fallback до загрузки и при ошибке; словарь из хранилища не шлёт запрос после пересоздания контекста; запись старше 7 дней перезапрашивается; мусор в хранилище не роняет чтение
- [ ] запустить тесты и `make knip` — зелёные перед Task 11

### Task 11: Хелпер `renderWithRouter` и перевод тестов на него

**Model:** sonnet — механический рефакторинг трёх десятков файлов, ошибки ловят сами тесты

**Files:**

- Create: `src/test/router.tsx`
- Modify: тестовые файлы с `MemoryRouter` (список — `grep -rl MemoryRouter src`, 31 файл), кроме исключений ниже

Не переводятся: тесты файлов, удаляемых в Task 16 (`useFilterState.test.tsx`, тесты `usePageSync`, `useMovieCatalog`, `useCatalogUpdateStatus`, `useSearchAnalytics`).

- [ ] создать `renderWithRouter(ui, { url, path? })` — пока обёртка над `MemoryRouter`; с `path` оборачивает `ui` в `<Routes><Route path>` (нужно тестам с `useParams`: `MoviePage.test.tsx`, `PersonPage.test.tsx`); возвращает `getUrl()` (pathname + search)
- [ ] перевести тесты с `MemoryRouter` на хелпер; проверки URL — через `getUrl()` внутри `waitFor`, а не `useLocation`-пробники
- [ ] тесты с собственной конфигурацией роутов пометить комментарием «переписывается в Task 15»: `src/app/router.test.tsx` (реальный `router` + `RouterProvider`), `src/app/providers.test.tsx`, `src/app/layouts/AppLayout.test.tsx` (`createMemoryRouter`), `Header.test.tsx` и `Card.test.tsx` (`<Routes>` с несколькими роутами)
- [ ] запустить тесты — зелёные перед Task 12

### Task 12: Строители путей `paths`

**Model:** sonnet — механическая замена литералов путей, ещё на React Router

**Files:**

- Create: `src/shared/config/{paths.ts,paths.test.ts}`
- Modify: `src/shared/config/index.ts`, прод-файлы с литералами путей в `to=` / `navigate(...)`

- [ ] `paths.ts`: строители для всех десяти роутов; `paths.search(params?)` принимает `Record<string, string>` или `URLSearchParams` — сериализацию фильтров (`filtersToSearchParams`) делает вызывающий слой, `shared` о фильтрах не знает
- [ ] `ROUTE_PATTERNS` и `matchRoutePattern(pathname)` — шаблон роута или `null` для неизвестного пути
- [ ] перевести все `to=` и `navigate(...)` на `paths.*`
- [ ] тесты строителей: кодирование id, пустые и непустые параметры поиска
- [ ] тесты `matchRoutePattern`: каждый из десяти роутов, `/movie/1` и `/movie/2` дают один шаблон, хвостовой слэш, неизвестный путь → `null`
- [ ] запустить тесты — зелёные перед Task 13

### Task 13: Модели URL-состояния `/search`

**Model:** opus — семантика записи в URL и сбросов; ошибки здесь тонкие и проходят простые проверки

**Files:**

- Create: `src/features/catalog-filter/model/{searchState.ts,searchState.test.ts}`
- Create: `src/entities/movie/model/{searchMovies.ts,searchMovies.test.ts}`
- Create: `src/pages/search/model/{catalog.ts,catalog.test.ts}`
- Create: `src/features/catalog-filter/model/types.ts`
- Modify: `src/features/catalog-filter/index.ts`, `src/features/catalog-filter/lib/{searchParams,filtersToParams}.ts`, `src/features/catalog-filter/model/useFilterState.ts`, `src/features/catalog-filter/ui/{FilterPanel,ActiveFilterChips}/*.tsx`, `src/entities/movie/index.ts`
- Modify: `src/widgets/header/index.ts`, `src/widgets/header/ui/Header/{index.tsx,Header.tsx}`, `src/pages/home/ui/HeroSection/HeroSection.tsx`, `src/pages/search/model/usePageSync.ts`

Модели в этой задаче не подключены к UI: в тестах атомы подписаны, URL выставляется через `urlAtom`. Экспорты, у которых потребитель появится только в Task 15, в баррели не добавляются до Task 15 (иначе knip).

- [ ] `types.ts`: перенести `FilterState` и `TYPE_LABELS` из `useFilterState.ts`; обновить импорты в `lib/`, `ui/`, тестах и барреле
- [ ] `searchState.ts`: чтение и запись по Technical Details (`FilterChip` + `removeFilterChip`); `resetPageToOne` переезжает из `usePageSync.ts` в `lib/searchParams.ts`
- [ ] `QUERY_MIN_LENGTH` и `QUERY_DEBOUNCE_MS` переезжают из `Header.tsx` в `searchState.ts` и экспортируются из `@features/catalog-filter`; `Header` и `HeroSection` импортируют их оттуда, реэкспорт из `@widgets/header` убрать
- [ ] событие `filter changed` — в actions фильтров, как сейчас
- [ ] `searchMovies.ts`: `fetchSearchMovies` — `action + withAsync + withQueryCache()`; тип `SearchMoviesResult` переезжает сюда, `getSearchMovies.ts` импортирует его отсюда
- [ ] `catalog.ts`: `catalog`; `effect` в его connect-hook вызывает `normalizeSearchUrl` при каждой смене URL и отслеживает `search submitted` при каждой смене `q` (`sleep(800)` + `withAbort`, без повторов для того же запроса)
- [ ] тесты (проверяется URL): deep-link `/search?q=…&page=3&genres=…` — страница сохраняется, фильтры и сортировка вычищены; то же при переходе на такой URL без переподключения `catalog`
- [ ] тесты: `setFilters` / `toggleGenre` / `resetFilters` / `removeFilterChip` сбрасывают `page`; `setSort` страницу сохраняет; `goToPage` пишет страницу и вызывает `window.scrollTo` (spy); `submitSearchQuery` из режима фильтров оставляет в URL только `q`; каждая мутация — один `replaceState`
- [ ] тесты: `search submitted` уходит один раз на каждое новое значение `q`, а не только при подключении
- [ ] тесты: мусор в параметрах даёт дефолты; вне `/search` состояние пустое; запрос короче порога не пишется в `?q`
- [ ] тесты: `searchDraft` принимает ввод и следует за URL при back/forward; быстрый ввод даёт одну запись после debounce
- [ ] тесты `catalog`: режим поиска против режима каталога; возврат на уже загруженную страницу не шлёт запрос; старые данные остаются во время обновления; ответ устаревшего запроса не перезаписывает результат более нового при быстрой смене параметров
- [ ] запустить тесты — зелёные перед Task 14

### Task 14: Листовые ссылки — `<Link>` → `<a href>`

**Model:** sonnet — механическая замена в перечисленных файлах, ещё под React Router

**Files:**

- Modify: `src/entities/movie/ui/Card/Card.tsx`, `src/widgets/movie-rail/ui/MovieRail/MovieRail.tsx`, `src/pages/movie/ui/MovieHero/MovieHero.tsx`, `src/pages/movie/ui/tabs/CastTab/CastTab.tsx`, `src/pages/movie/ui/tabs/OverviewTab/OverviewTab.tsx`, `src/pages/person/ui/Filmography/CreditGroup/CreditGroup.tsx`, `src/pages/profile/ui/Profile/Profile.tsx`, `src/widgets/header/ui/Header/Header.tsx` (только логотип) и их тесты

Известный разрыв до Task 15: под React Router клик по `<a href>` даёт полную перезагрузку страницы. `NavLink` в `ProfileAvatar`, `Link` в `AppLayout` и вся программная навигация остаются до Task 15.

- [ ] заменить `<Link to={…}>` на `<a href={paths.…}>` в перечисленных файлах; stretched-link `Card` и его стекинг (`ui-patterns.md`) не меняются
- [ ] тесты этих компонентов: проверять `href`, а не переход по клику; `Card.test.tsx` больше не нуждается в `<Routes>`
- [ ] e2e-селектор `a[href^="/movie/"]` остаётся валидным — проверить поиском по `e2e/`
- [ ] запустить `make test`, `make typecheck`, `make lint` — зелёные перед Task 15

### Task 15: Замена React Router на `reatomRoute` — ядро

**Model:** opus — меняет поведение, общее для всех страниц и виджетов; должно остаться согласованным

**Files:**

- Create: `src/app/routes.tsx`, `src/app/routes.test.tsx`, `src/app/reatom.d.ts`, `src/app/ui/NotFound/{index.tsx,NotFound.module.css}`
- Modify: `src/app/providers.tsx`, `src/app/providers.test.tsx`, `src/app/layouts/AppLayout.tsx`, `src/app/layouts/AppLayout.test.tsx`, `src/app/sentry.ts`, `src/app/sentry.test.ts`, `src/test/router.tsx`
- Modify: `src/widgets/header/ui/Header/Header.tsx`, `src/widgets/mobile-chrome/ui/{BottomNav/BottomNav.tsx,MobileHeader/MobileHeader.tsx}`, `src/features/profile/ui/ProfileAvatar/ProfileAvatar.tsx`, `src/pages/home/ui/HeroSection/HeroSection.tsx` и их тесты
- Modify: `src/pages/movie/MoviePage.tsx`, `src/pages/person/PersonPage.tsx` и их тесты
- Modify: `src/pages/search/ui/**` (`Search`, `ActiveFilterChips`, `FilterPanel`, `SearchResultsGrid`) и их тесты; `src/features/catalog-filter/index.ts`
- Delete: `src/app/router.tsx`, `src/app/router.test.tsx`

Удаляемые в Task 16 модули (`useFilterState`, хуки `pages/search/model`, `getMoviesPage`, `getSearchMovies`) после этой задачи остаются без потребителей; пакет `react-router` ещё установлен, поэтому они и их тесты продолжают типизироваться. `make knip` в гейт этой задачи не входит.

Известный разрыв до Task 17: скролл при навигации не сбрасывается и не восстанавливается.

- [ ] `routes.tsx`: `layoutRoute`, десять дочерних роутов с `render`, `RouterOutlet` (`reatomComponent`); страницы остаются ленивыми через `lazyNamed`; `RouteChild` — в `src/app/reatom.d.ts` с `oxlint-disable-next-line`
- [ ] `NotFound`: заголовок и `<a href={paths.home()}>` на главную, стили через токены в `NotFound.module.css`; для неизвестного пути `AppLayout` показывает chrome главной (на мобильном — с `BottomNav`)
- [ ] `AppLayout` → `reatomComponent` с `children`, без импорта `routes.tsx`: chrome — по `matchRoutePattern(urlAtom().pathname)`, `activeNav` для `/search` — из `filters().type`; `key` у `ErrorBoundary` — `urlAtom().pathname`; `trackPageview` по смене `pathname` (не по смене query); убрать `<ScrollRestoration />`
- [ ] `providers.tsx` рендерит `<RouterOutlet />` внутри `GlobalErrorBoundary`; `Providers` остаётся обычным компонентом и атомы не читает
- [ ] `ProfileAvatar`: `<a>` + `aria-current='page'` по `urlAtom().pathname === paths.profile()`; тест на `aria-current` сохраняется
- [ ] `BottomNav`, `MobileHeader`: `urlAtom.go(...)` и `history.back()` по таблице замен; `BottomNav` сохраняет `replace` при совпадении `pathname + search + hash`, тест на это сохраняется
- [ ] `/movie/:id` и `/person/:id`: id приходит пропом из `render` (данные пока через прежние хуки и `AsyncBoundary` — до Task 18); `key={id}` у `Movie` сохраняется
- [ ] `Search`, `ActiveFilterChips`, `FilterPanel`, `SearchResultsGrid` → модели Task 13; скелетон по `isFirstPending`, бейдж «Updating…» при обновлении поверх старых данных
- [ ] `Header` → `searchDraft` / `commitSearchDraft`; `HeroSection` → один `urlAtom.go(paths.search({ q }))`
- [ ] `sentry.ts`: заменить `reactRouterBrowserTracingIntegration` на `browserTracingIntegration()` без хуков роутера (имена по шаблону роута — Task 19)
- [ ] `renderWithRouter`: выставляет URL через `history.replaceState`, рендерит без провайдера роутера; опция `path` удаляется (id передаётся пропом); `getUrl()` читает `urlAtom()`
- [ ] `routes.test.tsx`: каждый путь рендерит свою страницу; неизвестный путь → `NotFound`; `paths.*` и `ROUTE_PATTERNS` совпадают с роутами; клик по `<a>` меняет страницу без перезагрузки; `history.back()` возвращает предыдущую
- [ ] тест: навигация перерисовывает дерево, смонтированное через `Providers` (в сборке с React Compiler)
- [ ] переписать помеченные в Task 11 тесты (`providers.test.tsx`, `AppLayout.test.tsx`, `Header.test.tsx`) под новые роуты; сценарии `router.test.tsx` переезжают в `routes.test.tsx`
- [ ] `grep -rE "from 'react-router" src` находит только файлы, удаляемые в Task 16
- [ ] запустить `make test`, `make typecheck`, `make lint` — зелёные перед Task 16

### Task 16: Удаление React Router и старого слоя `/search`

**Model:** sonnet — удаление по списку, проверяется сборкой и knip

**Files:**

- Delete: `src/features/catalog-filter/model/useFilterState.ts`, `src/pages/search/model/{useMovieCatalog,usePageSync,useCatalogUpdateStatus,useSearchAnalytics}.ts`, `src/entities/movie/api/{getMoviesPage,getSearchMovies}.ts` и их тесты
- Modify: `src/features/catalog-filter/index.ts`, `src/entities/movie/index.ts`, `package.json` (удалить `react-router`)

- [ ] удалить перечисленные модули, их тесты и экспорты из баррелей (в том числе тип `ActiveChip`)
- [ ] удалить `react-router` из зависимостей; `grep -r react-router src` пуст (кроме комментариев — их обновить или убрать)
- [ ] запустить `make test`, `make typecheck`, `make lint`, `make knip` — зелёные перед Task 17

### Task 17: Восстановление скролла

**Model:** opus — порядок событий истории и момента отрисовки; ошибка не ловится простыми проверками

**Files:**

- Create: `src/app/model/{scrollRestoration.ts,scrollRestoration.test.ts}`
- Modify: `src/app/reatom-setup.ts`, `src/test/setup.ts`

- [ ] `urlAtom.sync` не заменять: модель слушает `urlAtom`; перед сменой сохраняет позицию под `history.state?.key`; после навигации (после `setTimeout(0)`) проставляет ключ новой записи через `history.replaceState({ ...history.state, key }, '')`
- [ ] позиции — в `sessionStorage`; новая запись истории со сменой `pathname` → скролл в начало; `popstate` → восстановление позиции по ключу из `history.state`
- [ ] алгоритм восстановления: попытки на каждом кадре (`requestAnimationFrame`), пока высота документа не позволяет достичь сохранённой позиции; прекращаются при успехе, при пользовательском скролле или по истечении 1 секунды — единый критерий и для роутов с loader, и для страниц без него
- [ ] смена только query-параметров (`replace` на `/search`) скролл не трогает — плавный скролл наверх в `goToPage` делает сама модель поиска; `history.scrollRestoration = 'manual'`
- [ ] запуск модели — action инициализации в `src/app/reatom-setup.ts`; модульное состояние сбрасывается в общем `afterEach`
- [ ] тесты (`window.scrollTo` в jsdom не реализован — spy): переход кликом по `<a>` сбрасывает скролл; переход через `urlAtom.go` — тоже; back восстанавливает, в том числе когда контент дорастает до нужной высоты не сразу; смена `?q` не скроллит
- [ ] запустить тесты — зелёные перед Task 18

### Task 18: Loaders для `/movie/:id` и `/person/:id`, удаление старого слоя запросов

**Model:** sonnet — паттерн loader и `AsyncContent` задан; удаление проверяется сборкой и knip

**Files:**

- Modify: `src/app/routes.tsx`, `src/pages/movie/MoviePage.tsx`, `src/pages/person/PersonPage.tsx`, `src/pages/movie/ui/**`, `src/entities/movie/model/movieDetail.ts`
- Create: `src/entities/person/model/{personDetail.ts,personDetail.test.ts}`
- Modify: `src/entities/{movie,person}/index.ts`, `src/shared/lib/index.ts`, `src/shared/ui/index.ts`, `src/test/setup.ts`
- Delete: `src/entities/movie/hooks/`, `src/entities/person/hooks/`, `src/entities/movie/api/{getMovieDetail,getMovieImages}.ts`, `src/entities/person/api/getPersonDetail.ts`, `src/shared/lib/{cachedFetcher,sessionCache}/`, `src/shared/ui/AsyncBoundary/` и их тесты (мапперы `mapDocToMovie`, `mapDtoToMovieDetail`, `mapDtoToPersonDetail` и `paginationConfig` остаются в `api/`)

- [ ] `movieDetail.ts`: `fetchMovieImages` (`action + withAsync + withQueryCache({ length: 100, ignoreAbort: true })`) и `loadMovieDetailBundle(id)` — деталь обязательна, картинки допускают отказ (как `combineDetail`); типы `MovieImage`, `MovieDetailBundle` переезжают сюда
- [ ] `movieRoute`: loader вызывает `loadMovieDetailBundle`; невалидный id → `ApiError` со статусом 404
- [ ] `personRoute`: loader поверх `fetchPersonDetail` (`action + withAsync + withQueryCache({ length: 50, ignoreAbort: true })`)
- [ ] `MoviePage` / `PersonPage` → `reatomComponent`, проп `loader` типизирован типом ядра; скелетон при `!ready()`, различение 404 и прочих ошибок, retry — `loader.retry`
- [ ] удалить `createCachedFetcher`, `sessionCache`, `AsyncBoundary`, `resetAllCachedFetchers` из `setup.ts`
- [ ] тесты: `/movie/1 → /movie/2` показывает скелетон, а не фильм 1; `/movie/abc` и 404 API → «Movie not found»; отказ картинок не ломает страницу
- [ ] тесты: возврат на уже открытый фильм не шлёт запрос; повторный заход на упавший роут шлёт ровно один запрос
- [ ] запустить тесты и `make knip` — зелёные перед Task 19

### Task 19: Sentry-трейсинг роутов

**Model:** opus — `sentry.md`: зелёные unit-тесты не означают, что трейсинг работает вживую; выбор между двумя подходами требует сверки с API пакета

**Files:**

- Modify: `src/app/sentry.ts`, `src/app/sentry-bootstrap.ts`, `src/main.tsx`, их тесты
- Create (только для запасного варианта): `src/app/model/{routeTracing.ts,routeTracing.test.ts}`

- [ ] основной вариант: оставить авто-спаны pageload/navigation у `browserTracingIntegration` и переименовывать их в `beforeStartSpan` — имя `matchRoutePattern(pathname)` (`/movie/:id`), источник `route`; неизвестный путь — отдельное фиксированное имя; сверить наличие и поведение `beforeStartSpan` с установленным `@sentry/react`
- [ ] проверить, создаёт ли авто-инструментирование navigation-спан на `replaceState` со сменой только query; если да — отфильтровать, смена query-параметров спан создавать не должна
- [ ] запасной вариант, если `beforeStartSpan` не подходит: выключить авто-спаны и создавать их вручную в `routeTracing.ts` (pageload при старте, navigation при смене шаблона роута); записать здесь, какой вариант выбран и почему
- [ ] обновить WHY-комментарии про порядок импортов в `main.tsx` / `sentry-bootstrap.ts`: требование «до создания роутера» заменяется на «до `reatom-setup`»
- [ ] тесты: `/movie/1` и `/movie/2` дают одно имя транзакции; смена query-параметров спан не создаёт
- [ ] существующие тесты PII-скраббинга и `captureRouteError` остаются зелёными
- [ ] запустить тесты — зелёные перед Task 20

### Task 20: Бюджеты бандла, code splitting, knip

**Model:** sonnet — измерить и зафиксировать, проверки автоматические

**Files:**

- Modify: `package.json` (`size-limit`), `vite.config.ts`, `knip.jsonc`, `bundle.config.ts` при необходимости

- [ ] `make build-only` и `make analyze`: убедиться, что страницы остались отдельными чанками, а `routes.tsx` не втянул их в entry; `NotFound` лежит в entry — проверить, что он не съел запас бюджета
- [ ] выставить бюджеты `size-limit` по правилу `build-budgets.md` (измеренный gzip + 15%, `entry` мерить с `VITE_SENTRY_DSN`); записать дельты `vendor`/`shared`/`entry` относительно `main` в раздел Progress Tracking этого файла
- [ ] `make knip` — чисто; убрать устаревшие исключения и комментарии в `knip.jsonc`
- [ ] `make check` и `make size` — зелёные перед Task 21

### Task 21: Проверка критериев приёмки

**Model:** sonnet — сверка результата с планом и устранение расхождений

**Files:**

- Modify: `e2e/*.spec.ts` — только при изменившемся наблюдаемом поведении

- [ ] все пункты таблицы соответствия 3.3 реализованы
- [ ] `grep -rE "react-router|createStorageSlot|createCachedFetcher|useSyncExternalStore" src e2e knip.jsonc` — пусто; устаревшие комментарии (`src/app/chunkPreloadRecovery.ts`, `GlobalErrorBoundary.tsx`, `e2e/utils/movieCard.ts`, `e2e/person-detail.spec.ts`, `knip.jsonc`) обновить или убрать
- [ ] ни один обычный (не `reatomComponent`) компонент не вызывает атом напрямую — проверить поиском по импортам моделей
- [ ] ни на одном `computed` нет `withCache` / `withQueryCache`
- [ ] `useViewport()` по-прежнему имеет ровно двух потребителей
- [ ] `make check`, `make test`, `make knip`, `make size` — зелёные
- [ ] `make build-only && make e2e` — один прогон
- [ ] покрытие (`make coverage`) не ниже текущего уровня ветки

### Task 22: [Final] Документация

**Model:** sonnet — документация описывает уже построенное поведение

**Files:**

- Modify: `README.md`, `AGENTS.md`, `.claude/rules/*.md`, `plans/roadmap.md`
- Move: этот план → `docs/plans/completed/`

- [ ] `README.md`: раздел ветки — паттерны Reatom v1001, плюсы и минусы, дельта бандла из Task 20, список принятых изменений поведения (нет сигнала о сбое записи, нет кэша ошибок, словари, страница `NotFound`)
- [ ] `AGENTS.md` (на английском): убрать gotcha про `createStorageSlot().set()` и про `useDeferredValue` над `useSearchParams()`; стек, раздел Routing, API-слой, Data summary, Testing; второе исключение `interface` (`src/app/reatom.d.ts`); убрать упоминания удалённых хуков и `createStorageSlot`
- [ ] `.claude/rules/*.md` — сначала удалить устаревшее: `search-catalog.md` (`areFiltersEqual` / `usePageSync` / `createDictionaryCache`), `data-layer.md` (`ErrorState` без `react-router`, `invalidate*`, кэш ошибок), `ui-patterns.md` (`themeSlot`, `<Link>`), `sentry.md` (репортер хранилища), `analytics.md` (`favorite added` только при успешной записи), `profile.md` и `build-budgets.md` (`router.tsx`, `AsyncBoundary`, сообщение о сбое сохранения)
- [ ] `.claude/rules/*.md` — затем дописать (на английском, только неочевидное): `storage.md` — TTL persist в 1001.3.0, почему не `schema`, отказ от сигнала о сбое записи; `data-layer.md` — кэш только на action, отказ от кэша ошибок; `search-catalog.md` — одна запись в URL на мутацию, почему не `withSearchParams`; `ui-patterns.md` — ловушка React Compiler; `sentry.md` — именование спанов; `e2e.md`/тесты — порядок изоляции; обновить `paths:` во всех файлах под новые и удалённые файлы
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
