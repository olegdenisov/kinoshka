# Миграция ветки `zustand` на Zustand (roadmap 3.2)

## Overview

- Ветка `zustand` повторяет фичи Phase 1+2, но весь стейт идёт через Zustand: клиентский — изолированные сторы с `persist`, серверный — query-сторы, созданные общей фабрикой `createQueryStore`.
- Цель — честная база для сравнительной таблицы roadmap 3.8 (DX, бойлерплейт, размер бандла) рядом с веткой `rtk`, поэтому второго механизма кеша/стейта в ветке не остаётся: `createCachedFetcher`, `sessionCache`, `use()` + `AsyncBoundary`, `useStorageSlot` уходят.
- Поведение для пользователя не меняется: те же страницы, те же ключи и формат `localStorage` (`kinoshka:*`), e2e-спеки проходят без правок сценариев.
- **Ветка живёт параллельно `main` и в `main` не мержится.** Запрет обеспечивается job'ом `branch-guard` в CI `main` (обязательный check в ruleset `protect-main`) — тем же механизмом, что уже блокирует `rtk`.

Покрываемые пункты roadmap 3.2:

- `pnpm add zustand`
- несколько изолированных сторов (favorites, theme, filters — см. отклонение ниже)
- `persist` middleware для favorites/theme
- селекторы с `useShallow` для объектных слайсов
- README ветки

**Отклонения от буквальной формулировки roadmap** (согласованы при планировании):

- `useFiltersStore` с фильтрами каталога **не заводится**: URL остаётся единственным источником истины (`useFilterState` не трогаем). В стор уходит только не-URL UI-стейт страницы поиска — открытость шторок фильтров/сортировки (`useSearchUiStore`).
- Объём шире списка 3.2: в сторы переезжают также `watched`, `watchlist`, `profile` и весь серверный стейт — чтобы ветка была сравнима с `rtk`.

## Context (from discovery)

- Исходное состояние: ветка `zustand` создаётся от `main`, `zustand` не установлен.
- Клиентский стейт — 5 слотов `createStorageSlot` + `useStorageSlot`: `src/features/{favorites,theme,watched,watchlist,profile}/model/*`. `set()` возвращает `boolean`, `subscribe` слушает `storage`-событие (синхронизация вкладок).
- Тему до гидрации читает инлайн-скрипт в `index.html` из `kinoshka:theme` как голый JSON (`"dark"`). Родной формат `persist` — `{"state":…,"version":0}` — сломал бы скрипт (правка скрипта = правка CSP-хэша, см. `.claude/rules/csp.md`) и обнулил бы данные существующих пользователей. Формат ключей менять нельзя.
- Async — фетчеры на `createCachedFetcher` в `src/entities/movie/api/*`, `src/entities/person/api/*`; чтение через `use()` в `src/entities/*/hooks/*`, `src/features/{favorites,watched,watchlist}/model/use*Movies.ts`, `src/pages/search/model/useMovieCatalog.ts`, `src/pages/recommendations/model/useRecommendedMovies.ts`; Retry — через `invalidate*` + `AsyncBoundary.onRetry`.
- Пагинация каталога — обход курсора `next` 1..N в `src/entities/movie/api/getMoviesPage.ts`; текстовый поиск `getSearchMovies` — настоящий `page`.
- Справочники жанров/стран — `createDictionaryCache`: `localStorage`-кеш на 7 дней, фоновое обновление, кулдаун 60 с.
- `createStorageSlot` кроме фич используют `src/app/chunkPreloadRecovery.ts` и `src/app/sentry.ts` (`setStorageErrorReporter`) — сам слот остаётся.
- Не-URL стейт `/search`: `filtersOpen`/`sortOpen` (`useState` в `src/pages/search/ui/Search/Search.tsx`).
- Тесты: MSW с `onUnhandledRequest: 'error'`, глобальный сброс module-level кешей в `src/test/setup.ts`.
- Бюджеты: `size-limit` в `package.json` (`vendor` 184.7 KB gzip, `shared` 22.6 KB).
- Лимит demo-API — 200 запросов/день: e2e гоняем один раз в конце.
- Прецедент: `docs/plans/completed/20261001-rtk-migration.md` в ветке `rtk` (`git show rtk:docs/plans/completed/20261001-rtk-migration.md`) — структура задач и контракт `QueryBoundary` взяты оттуда.

## Development Approach

- **testing approach**: Regular (код, затем тесты в той же задаче)
- каждую задачу доводим до конца, прежде чем брать следующую; изменения маленькие и сфокусированные
- **CRITICAL: каждая задача включает новые/обновлённые тесты** на код этой задачи (успех + ошибки)
- **CRITICAL: все тесты зелёные перед следующей задачей** — `make test`, `make typecheck`, `make lint`
- **CRITICAL: при изменении объёма работ обновлять этот файл**
- вся разработка — в ветке `zustand` (или в feature-ветках с PR **в `zustand`**); PR в `main` из этой ветки не открываем. Единственное исключение — Task 1, чья правка CI обязана попасть в `main`
- **PR из feature-веток открывать только с `gh pr create --base zustand`**: по умолчанию `gh` берёт base = `main`, а `branch-guard` сверяет лишь имя head-ветки и такой PR не остановит
- прямые коммиты в `zustand` CI не запускают (`on.push.branches: [main]`) — принято осознанно; `make knip`/`make size` прогоняются локально в Task 16–18
- публичные сигнатуры хуков клиентского стейта (`useFavorites`, `useTheme`, `useWatched`, `useWatchlist`, `useProfile`) сохраняются — продакшен-код потребителей не трогаем. Тесты потребителей трогаем один раз в Task 2: прямой сидинг `localStorage.setItem(...)` module-level стор не увидит (он гидрируется при импорте), поэтому сиды переводятся на хелпер; после этого существующие тесты работают как регрессионная сетка
- хуки серверных данных меняют контракт: вместо значения возвращают `QueryResult<T>` (`data`/`isLoading`/`isFetching`/`isError`/`error`/`refetch`)
- в промежуточных задачах старый и новый data-layer сосуществуют; каждая задача удаляет старый фетчер-кеш своих запросов, остатки добивает Task 16
- конвенции проекта: `type` вместо `interface`, без ручных `useMemo`/`useCallback`, WHY-комментарии на русском, импорты только через barrel `index.ts`, FSD-направление импортов

## Testing Strategy

- **unit**: экшены и селекторы сторов — через `store.getState()` без React; persist — через `localStorage` + `rehydrate()`; query-сторы — фабрика с фейковым фетчером и fake timers, конкретные сторы — через MSW; хуки и страницы — Testing Library
- **изоляция тестов**: сторы — module-level синглтоны, поэтому фабрики регистрируют каждый созданный стор в общем реестре, а `src/test/setup.ts` в `afterEach` вызывает `resetAllStores()` (после `localStorage.clear()`). Тот же приём, что сейчас `resetAllCachedFetchers`
- **e2e** (`e2e/*.spec.ts`): сценарии не меняются — это критерий паритета поведения. Запускаются один раз в Task 18 (квота API)

## Progress Tracking

- выполненные пункты сразу помечать `[x]`
- новые задачи — с префиксом ➕, блокеры — с ⚠️
- при отклонении от плана обновлять план

## Solution Overview

**Раскладка по FSD**

| Что                                                       | Где                                              | Почему                                                                                                            |
| --------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `createPersistedStore`, `createQueryStore`, реестр сторов | `src/shared/lib/store/`                          | инфраструктура без доменных типов: дженерики по форме стейта/параметров/данных                                    |
| `QueryBoundary`                                           | `src/shared/ui/QueryBoundary/`                   | принимает результат запроса структурным типом, не импортирует ни zustand, ни сущности                             |
| сторы клиентского стейта                                  | `src/features/<feature>/model/<feature>Store.ts` | доменная логика остаётся в фиче                                                                                   |
| query-сторы фильмов/персон                                | `src/entities/{movie,person}/api/*`              | экземпляр стора создаётся в слайсе-владельце; `shared` доменных данных не хранит                                  |
| query-стор рекомендаций                                   | `src/pages/recommendations/model/`               | комбинирует `@features/favorites` + `@features/recommendations` + `@entities/movie` — легально только в page-слое |
| `useSearchUiStore`                                        | `src/pages/search/model/`                        | стейт одной страницы, наружу не экспортируется                                                                    |

Провайдер не нужен: сторы Zustand — module-level, `src/app/providers.tsx` не меняется (пункт для сравнения с `rtk`).

**Ключевые решения**

- **Много маленьких сторов, не один гигантский** (roadmap 3.2). Каждая фича и каждый запрос — отдельный стор; компонент подписывается только на свой.
- **Persist — `persist` middleware с кастомным `storage` поверх существующего `createStorageSlot`.** Адаптер читает/пишет слот, поэтому сохраняются: ключи и голый JSON-формат (инлайн-скрипт темы и CSP-хэш не трогаем), zod-валидация на чтении, `setStorageErrorReporter` → Sentry. Гидрация синхронная (слот синхронный) — первый рендер уже с данными, FOUC нет. Опции `version`/`migrate` не используем: формат не оборачивается в envelope.
- **Неудачная запись не видна в UI.** `slot.set()` возвращает `false` (квота/приватный режим). Адаптер запоминает результат последней записи; обёртка `createPersistedStore` после неудачи возвращает стор к содержимому хранилища через `store.persist.rehydrate()`. На этом держится `boolean`-результат `useProfile().setName` и правило «`trackEvent('favorite added')` только при успешной записи».
- **Синхронизация вкладок**: `slot.subscribe` → `store.persist.rehydrate()`. Подписка срабатывает и на `set()` в своей вкладке, причём синхронно внутри `slot.set()`. Собственные уведомления пропускаем по флагу «идёт собственная запись», который адаптер держит на время `setItem`. Сравнивать значение по ссылке нельзя: `slot.set()` сбрасывает кеш, и следующий `slot.get()` для массива/объекта возвращает новую ссылку.
- **Read-modify-write читает `get()` стора**, а не замыкание хука — два toggle в одном тике не затирают друг друга (то же правило, что сейчас в `storage.md`).
- **Селекторы.** Примитив/одно поле — простой селектор (`useFavoritesStore(s => s.ids)`); несколько полей объектом — `useShallow`. Экшены стабильны по ссылке и берутся отдельным селектором. Ручной `useMemo` не добавляем (React Compiler).
- **`createQueryStore` — мини-кеш запросов на vanilla-сторе.** Стейт: записи по сериализованному ключу параметров `{ status, data, error, updatedAt }`. In-flight промисы — в замыкании (не в стейте): дедупликация параллельных запросов. TTL 5 минут (как `CACHE_TTL_MS`), для popular — 24 ч. **20-секундный кулдаун ошибок сохраняем** — он бережёт квоту 200 запросов/день; `refetch()` его обходит (аналог нынешнего `invalidate` + Retry).
- **Запросы стартуют из эффекта, не во время рендера**: `useQuery(params)` подписывается на запись своего ключа и в `useEffect` вызывает `ensure(params)`. Suspense и `use()` для данных уходят.
- **Композиция кеша** — императивный `queryStore.fetch(params): Promise<TData>` (с той же дедупликацией и TTL). Так `getMoviesByIds` делит кеш с детальной страницей фильма, а обход курсора каталога — с собственными шагами. Важно для квоты.
- **Кулдаун ошибок действует только на автоматический запуск из `useQuery`.** Императивный `fetch()` закешированную ошибку не реплеит, а перезапрашивает (успешные записи и in-flight берёт из кеша). Иначе Retry составного стора был бы мёртв 20 секунд: `refetch()` снимал бы кулдаун только со своего ключа, а вложенные шаги отдавали бы старую ошибку. Квоту при этом бережёт кулдаун верхнего ключа.
- **Ошибка хранится как есть** (`ApiError` со `status`) — стор не обязан быть сериализуемым, 404-ветка `/movie/:id` работает без преобразований.
- **`QueryBoundary` заменяет `AsyncBoundary`**: `isError` → `ErrorState` с Retry = `refetch` (даже при наличии старых данных — как на `main`); `isLoading` или `data === undefined` → `fallback`; иначе `children(data)`. `ErrorBoundary` для ошибок рендера остаётся.
- **Stale-while-fetching на `/search`**: опция `keepPreviousData` в `useQuery` держит данные прошлого ключа, пока грузится новый; `isFetching` — индикатор «Updating…». Зеркало `useState` + `useDeferredValue` в `useCatalogUpdateStatus` становится не нужно.
- **Рекомендации — отдельный query-стор с ключом `ids` избранного.** Его `fetcher` делает всю цепочку: `moviesByIdsStore.fetch(ids)` → `computeRecommendationQuery` → `catalogPageStore.fetch(...)` и возвращает `Movie[] | null`. Один `QueryResult`, один `refetch`, промежуточные состояния двух запросов склеивать не нужно. Избранное изменилось → ключ изменился → запрос сам перезапрашивается; module-level переменная для Retry (`invalidateRecommendations`) уходит. Аналог tag-invalidation из `rtk` здесь не нужен — пункт для README.
- **DevTools**: `devtools` middleware из `zustand/middleware` подключается внутри фабрик только при `import.meta.env.DEV`, с осмысленным `name` стора. В проде в бандл не попадает.

**Сознательно теряем** (фиксируем в README и `data-layer.md`):

- `sessionStorage`-персист кеша запросов в DEV (вместе с ним уходит DEV-баг с потерей `ApiError.status` при реплее)
- Suspense-интеграцию: состояния загрузки читаются из статуса, а не из `<Suspense>`
- вытеснение записей кеша (на `main` оно есть в `createCachedFetcher`): записи живут до перезагрузки страницы. Следствие — протухшие данные показываются сразу и обновляются в фоне, а не заменяются скелетоном

**Вне объёма**: связка с TanStack Query (roadmap 3.7), `immer` middleware, изменение сценариев e2e, фильтры каталога в сторе.

## Technical Details

```ts
// src/shared/lib/store/createPersistedStore.ts
createPersistedStore<TState, TPersisted>({
  name, // имя для devtools
  slot, // StorageSlot<TPersisted> — существующий createStorageSlot
  select, // (state) => TPersisted — что пишем (partialize)
  merge, // (persisted, state) => TState — как кладём прочитанное в стейт
  creator, // (set, get) => TState
})
// → UseBoundStore с .persist; дополнительно commit-хелпер: применить апдейт и вернуть boolean
//   (false → стор уже возвращён к содержимому хранилища)

// src/shared/lib/store/createQueryStore.ts
type QueryResult<TData> = {
  data: TData | undefined
  isLoading: boolean // нет данных и идёт первый запрос
  isFetching: boolean // идёт любой запрос, включая фоновый
  isError: boolean
  error: unknown
  refetch: () => void
}

createQueryStore<TParams, TData>({
  name,
  fetcher, // (params) => Promise<TData>
  getKey = JSON.stringify, // стабильная сериализация параметров
  ttlMs = 5 * 60_000,
  errorCooldownMs = 20_000,
})
// → {
//     useQuery(params, { skip?, keepPreviousData? }): QueryResult<TData>
//     fetch(params): Promise<TData>   // для композиции внутри других fetcher'ов
//     invalidate(params?): void
//     reset(): void
//   }

// src/shared/lib/store/registry.ts
registerStoreReset(fn) // вызывают обе фабрики
resetAllStores() // только для src/test/setup.ts
```

- Семантика `fetch()` и кулдауна: `useQuery` при закешированной ошибке моложе 20 с запрос не запускает; `fetch()` и `refetch()` запускают всегда, кроме случаев «есть свежие данные» и «запрос уже в полёте».
- `isFetching` выводится синхронно: если записи ключа нет или она протухла и нет `skip`, хук уже в первом рендере отдаёт `isFetching: true` — иначе при `keepPreviousData` был бы кадр «старые данные без индикатора» (запуск идёт из `useEffect`).
- Шаблон query-стора (задаётся Task 10, повторяется в Task 11–14): в файле `api/getX.ts` — чистая функция запроса `fetchX(params)` и экземпляр `xQueryStore = createQueryStore({ name: 'x', fetcher: fetchX })`; хук `useX(params)` в `hooks/` возвращает `xQueryStore.useQuery(params)`; из barrel слайса экспортируются хук и, только если нужен композиции в другом слое, сам стор. `invalidate*` наружу не экспортируются.
- Формы стейта клиентских сторов: `favorites/watched/watchlist: { ids: number[] } + экшены`, `theme: { theme: Theme } + экшены`, `profile: { name: string } + экшены`. В `localStorage` уходит только значение (`number[]`, `Theme`, `string`), не объект стейта.
- `useTheme` сохраняет подписку на `prefers-color-scheme` и эффект с `data-theme` на `<html>` — из стора читается только `theme`.
- Пагинация каталога: внутренний query-стор шага курсора (`{ params, cursor }` → один сетевой запрос, `withCount` только на первом шаге) + стор страницы (`{ params, page }`), чей `fetcher` обходит шаги 1..page через `cursorStepStore.fetch(...)` и возвращает `{ movies, totalPages }`. Логика `toTotalPages`/«курсор кончился раньше» переносится как есть. Текстовый поиск — обычный `page` и чистая функция `fetchSearchMovies` без собственного стора (второго потребителя нет, отдельный стор дал бы двойной кеш). Поверх — единый стор каталога `{ query, params, page }`: один стор = один `useQuery`, поэтому при переключении режима поиск ↔ каталог `keepPreviousData` держит прежнюю сетку.
- Рекомендации возвращают `Movie[] | null` (`null` — избранное пусто/не дало правила; различие `null` vs `[]` для UI сохраняется). `null` возвращает сам `fetcher` без сетевого запроса — `skip` не используется, потому что при `skip` `data === undefined` и `QueryBoundary` показывал бы fallback бесконечно.
- Справочники: стор на `createPersistedStore` поверх прежнего слота (`{ items, fetchedAt }`, прежний ключ), фоновое обновление и 60-секундный кулдаун — экшен стора; хук остаётся синхронным (без `QueryBoundary`).

## What Goes Where

- **Implementation Steps** — код, тесты, документация в этом репозитории
- **Post-Completion** — ручная проверка DevTools, визуальный прогон, настройки GitHub

## Implementation Steps

### Task 1: Ветка `zustand`, запрет слияния в `main`, CI на PR в ветку

⚠️ Вынесена в бэклог: `docs/backlog/zustand-ci-branch-guard.md` (правка CI и push заблокированы классификатором при автозапуске; Task 2–19 от неё не зависят). Ветка `zustand` создана локально, план в ней закоммичен, в `origin` не запушена.

### Task 2: Zustand и инфраструктура persist (`createPersistedStore`)

**Model:** opus — фундамент для всех клиентских сторов; откат при неудачной записи и защита от записи обратно легко проходят поверхностные тесты

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/shared/lib/store/createPersistedStore.ts`, `src/shared/lib/store/createPersistedStore.test.ts`
- Create: `src/shared/lib/store/registry.ts`, `src/shared/lib/store/index.ts`
- Create: `src/test/seedStorage.ts`
- Modify: `src/shared/lib/index.ts`, `src/test/setup.ts`
- Modify: все тестовые файлы с прямым `localStorage.setItem(` для ключей `kinoshka:*` (список — `grep -rln "localStorage.setItem" src`, на момент планирования 22 файла: тесты `Header`, `MobileHeader`, `MovieRail`, `Movie`, `Profile`, страниц списков и рекомендаций, хуков фич и др.)

- [x] `pnpm add zustand`
- [x] `registry.ts`: `registerStoreReset` / `resetAllStores`; `setup.ts` вызывает `resetAllStores()` в `afterEach` после `localStorage.clear()`
- [x] `seedStorage(key, value)`: `localStorage.setItem` + `window.dispatchEvent(new StorageEvent('storage', { key }))` — сид доходит до уже созданного стора тем же путём, что запись из другой вкладки. Перевести на него все прямые сиды в тестах одним проходом; пока сторов нет, хелпер безвреден (тесты остаются зелёными на `useStorageSlot`)
- [x] адаптер `PersistStorage` поверх `StorageSlot`: `getItem` отдаёт `slot.get()` в форме, которую ждёт `persist`, `setItem` пишет через `slot.set()` только значение, запоминает результат и держит флаг собственной записи, `removeItem` — `slot.remove()`
- [x] `createPersistedStore`: `persist` + (в DEV) `devtools`, синхронная гидрация, регистрация в реестре; `merge` — обязательный параметр (дефолтный spread-merge `persist` для `number[]` и строки даст мусор)
- [x] откат при `slot.set() === false`: стор возвращается к содержимому хранилища через `persist.rehydrate()`; если `rehydrate()` пишет значение обратно в storage — откат через `setState` в обход обёртки `persist`
- [x] commit-хелпер, возвращающий `boolean` успеха записи
- [x] подписка `slot.subscribe` → обновление стора из хранилища; собственные уведомления пропускаются по флагу адаптера
- [x] сверить по исходникам установленной версии `zustand` (не полагаться на память): синхронный `getItem` даёт гидрацию до возврата из `create`; какую форму и `version` ждёт `persist` от `getItem` (несовпадение `version` без `migrate` отбрасывает стейт); пишет ли `rehydrate()` обратно в storage; порядок композиции `devtools`/`persist`. Расхождения записать в план с ⚠️
- [x] проверить по `sentry.md`: стор читает слот один раз при импорте, до `initSentry()` и `setStorageErrorReporter` — сбой чтения может не дойти до Sentry. Если это регресс относительно `main`, зафиксировать в «Сознательно теряем» или перечитывать слот после подключения репортера
- [x] тесты: начальное значение из `localStorage`; запись в прежнем формате (голый JSON, без envelope); невалидный JSON/несовпадение схемы → fallback; неудачная запись → итоговый стейт прежний, `boolean === false`, повторной записи нет; `storage`-событие из другой вкладки обновляет стор; запись массива в своей вкладке даёт подписчикам ровно одно уведомление; `resetAllStores` перечитывает хранилище; `seedStorage` обновляет уже созданный стор; в тестовом окружении `devtools` не сыплет предупреждениями
- [x] `make test && make typecheck && make lint` — зелёные

Сверка с исходниками `zustand` 5.0.15 (результат пункта выше):

- синхронный `getItem` → гидрация до возврата из `create` (`toThenable` выполняет цепочку синхронно) — подтверждено
- `persist` ждёт от `getItem` `{ state, version? }`; числовая `version`, не равная `options.version` (по умолчанию `0`), без `migrate` → `console.error` и прочитанное отбрасывается (`merge` получает `undefined`). Адаптер отдаёт `version: 0`
- ⚠️ `rehydrate()` кладёт прочитанное исходным `set`, минуя обёртку `persist`, — обратно в хранилище **не пишет** (кроме случая с `migrate`). Откат через `setState` в обход обёртки не понадобился
- порядок композиции — `devtools(persist(...))`; без расширения Redux DevTools `devtools` возвращает инициализатор без изменений и без предупреждений
- `persist` возвращает из своего `set` результат `storage.setItem`, но commit-хелпер опирается на флаг адаптера — не зависит от типизации этого возврата
- Sentry: регресса нет — `sentry-bootstrap` первый импорт `main.tsx`, сторы фич создаются при импорте их модулей уже после `initSentry()`; к тому же репорт сбоя `get()` отложен на микротаску

### Task 3: Стор темы

**Model:** sonnet — сигнатура хука сохраняется, существующие тесты показывают паритет

**Files:**

- Create: `src/features/theme/model/themeStore.ts`, `src/features/theme/model/themeStore.test.ts`
- Modify: `src/features/theme/model/useTheme.ts`, `src/features/theme/model/useTheme.test.tsx`

- [x] `useThemeStore` на `createPersistedStore` поверх `themeSlot` (ключ `kinoshka:theme`, схема без изменений): `{ theme, setTheme }`
- [x] `useTheme` читает `theme` и `setTheme` селекторами; `prefersDark`, `resolveTheme`, эффект `data-theme` и `toggleTheme` — без изменений; `UseThemeResult` не меняется
- [x] `index.html` и CSP-хэш не тронуты (`git diff main -- index.html vercel.json` пуст)
- [x] тесты стора: `setTheme` пишет `"light"`/`"dark"`/`"system"` голым JSON; чтение сохранённого значения при создании
- [x] существующие `useTheme.test.tsx` проходят (правки — только в подготовке/сбросе стейта)
- [x] `make test && make typecheck && make lint` — зелёные

### Task 4: Сторы Watched и Watchlist

**Model:** sonnet — повторяет паттерн Task 3 на двух одинаковых id-списках

**Files:**

- Create: `src/features/watched/model/watchedStore.ts`, `src/features/watchlist/model/watchlistStore.ts` + тесты рядом
- Modify: `src/features/watched/model/useWatched.ts`, `src/features/watchlist/model/useWatchlist.ts`, их тесты

- [x] два независимых стора `{ ids, toggle }` на прежних слотах — ровно то, что отдают нынешние хуки (`add`/`remove`/`clear` у этих фич нет, не добавляем); общий код id-списка не выносим в абстракцию, пока это два файла (списки независимы — `user-lists.md`)
- [x] `toggle` читает `get().ids`, а не замыкание
- [x] хуки сохраняют текущие сигнатуры (`ids`, `isWatched`/`isInWatchlist`, `toggle`); `ids` и `toggle` — отдельными простыми селекторами
- [x] тесты сторов: toggle туда-обратно, два toggle в одном тике, неудачная запись не меняет `ids`
- [x] существующие тесты хуков проходят
- [x] `make test && make typecheck && make lint` — зелёные

### Task 5: Стор избранного

**Model:** sonnet — паттерн задан Task 4, правило аналитики покрыто существующими тестами

**Files:**

- Create: `src/features/favorites/model/favoritesStore.ts`, `src/features/favorites/model/favoritesStore.test.ts`
- Modify: `src/features/favorites/model/useFavorites.ts`, `src/features/favorites/model/useFavorites.test.ts`

- [x] `useFavoritesStore` `{ ids, toggle, add, remove, clear }` на `favoritesSlot` (ключ `kinoshka:favorites`)
- [x] `trackEvent('favorite added')` — только при добавлении и только когда запись удалась (commit-хелпер вернул `true`); WHY-комментарий переносится
- [x] `useFavorites` сохраняет `UseFavoritesResult`; `isFavorite` выводится из `ids`; экшены берутся одним селектором с `useShallow` (объектный слайс — пункт roadmap 3.2)
- [x] стор из `src/features/favorites/index.ts` не экспортируется — Task 14 получает `ids` через `useFavorites`
- [x] тесты стора: toggle туда-обратно, событие аналитики при успехе, отсутствие события при неудачной записи, cross-tab обновление
- [x] существующие `useFavorites.test.ts` проходят
- [x] `make test && make typecheck && make lint` — зелёные

### Task 6: Стор профиля

**Model:** sonnet — паттерн задан Task 2–3, `boolean`-контракт покрыт существующими тестами `/profile`

**Files:**

- Create: `src/features/profile/model/profileStore.ts`, `src/features/profile/model/profileStore.test.ts`
- Modify: `src/features/profile/model/useProfile.ts`, `src/features/profile/model/useProfile.test.tsx`

- [ ] `useProfileStore` на `profileNameSlot`; запись имени возвращает `boolean` — `/profile` единственное место, показывающее ошибку сохранения в UI (`storage.md`); `normalizeProfileName` применяется как сейчас
- [ ] `useProfile` сохраняет сигнатуру; в сторе одно поле `name` — простой селектор
- [ ] имя профиля — пользовательский ввод: в `name` стора для devtools и в сообщения об ошибках значение не попадает (`sentry.md`)
- [ ] тесты: успешная запись → `true` и новое значение; неудачная → `false`, значение прежнее; cross-tab
- [ ] существующие тесты `useProfile` и страницы `/profile` проходят
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 7: `useSearchUiStore` — не-URL стейт страницы поиска

**Model:** sonnet — маленький стор без persist, но нужен корректный сброс при уходе со страницы

**Files:**

- Create: `src/pages/search/model/searchUiStore.ts`, `src/pages/search/model/searchUiStore.test.ts`
- Modify: `src/pages/search/ui/Search/Search.tsx`, `src/pages/search/ui/Search/Search.test.tsx`

- [ ] стор без `persist`: `{ filtersOpen, sortOpen, openFilters, closeFilters, openSort, closeSort, reset }`; регистрация в реестре сброса
- [ ] `Search.tsx`: `useState` для `filtersOpen`/`sortOpen` заменить селекторами стора; каждый `BottomSheet` подписан только на свой флаг
- [ ] сброс при размонтировании страницы (`reset` в cleanup эффекта) — стор module-level, иначе шторка «вспомнит» открытость после возврата на `/search`
- [ ] `useFilterState` и URL-параметры не трогаем; WHY-комментарий у стора: фильтры живут в URL (ссылки, back/forward), в сторе — только то, чего в URL нет
- [ ] тесты стора: открыть/закрыть, независимость флагов, `reset`
- [ ] тест страницы: после размонтирования и повторного монтирования шторки закрыты
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 8: Фабрика `createQueryStore`

**Model:** opus — публичный API, на котором строятся Task 10–15; дедупликация, TTL, кулдаун и гонки ответов легко проходят собственные тесты

**Files:**

- Create: `src/shared/lib/store/createQueryStore.ts`, `src/shared/lib/store/createQueryStore.test.ts`
- Modify: `src/shared/lib/store/index.ts`, `src/shared/lib/index.ts`

- [ ] vanilla-стор записей по ключу + `useQuery`/`fetch`/`invalidate`/`reset` по сигнатурам из Technical Details; дженерики `TParams`/`TData`, никаких доменных типов
- [ ] in-flight промисы — в замыкании: параллельные `useQuery`/`fetch` с одним ключом дают один сетевой запрос
- [ ] TTL: свежая запись не перезапрашивается; протухшая отдаётся как данные и обновляется в фоне (`isFetching`)
- [ ] кулдаун ошибок 20 с: повторный монтаж (`useQuery`) не перезапрашивает; `refetch()`, `invalidate()` и императивный `fetch()` закешированную ошибку не реплеят, а перезапрашивают (см. Technical Details)
- [ ] защита от гонок: ответ устаревшего запроса не перезаписывает более новый результат того же ключа
- [ ] `useQuery`: запуск из `useEffect`; подписка только на запись своего ключа; `skip`; `keepPreviousData`; `isFetching` выводится синхронно для отсутствующей/протухшей записи; защита `refetch` от двойного клика
- [ ] `devtools` только в DEV; регистрация `reset` в реестре
- [ ] тесты (fake timers, фейковый `fetcher`): дедупликация, TTL, кулдаун и его обход, гонка ответов, `skip`, `keepPreviousData` при смене ключа (в первом же рендере нового ключа `isFetching === true`), ошибка после успешных данных, `invalidate` с параметрами и без, `fetch()` делит кеш с `useQuery`, изоляция двух экземпляров фабрики
- [ ] тест составного стора: `fetcher` стора A вызывает `B.fetch()` для нескольких ключей, один шаг падает → `refetch()` A перезапрашивает упавший шаг сразу, успешные шаги берутся из кеша (счётчик вызовов)
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 9: `QueryBoundary` в `@shared/ui`

**Model:** sonnet — контракт компонента описан в плане, поведение проверяется тестами

**Files:**

- Create: `src/shared/ui/QueryBoundary/index.tsx`, `src/shared/ui/QueryBoundary/QueryBoundary.test.tsx`
- Modify: `src/shared/ui/index.ts`

- [ ] пропсы: `query: { data?: T; isLoading: boolean; isError: boolean; error?: unknown; refetch: () => unknown }`, `fallback?`, `errorFallback?: ({ error, reset }) => ReactNode`, `children: (data: T) => ReactNode` — структурный тип, без импорта zustand
- [ ] `isError` → `errorFallback` (по умолчанию `ErrorState`), `reset` = `refetch` — даже если есть старые `data`; `isLoading` или `data === undefined` → `fallback` (по умолчанию `Spinner`); иначе `children(data)` — `children` никогда не получает `undefined`
- [ ] `ErrorState` по-прежнему не зависит от `react-router`
- [ ] тесты: три состояния, Retry вызывает `refetch`, кастомный `errorFallback`, пропущенный запрос (`data === undefined`, не loading) → `fallback`, ошибка перезапроса при старых данных → ошибка
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 10: Query-сторы рейлов и страницы Home/Popular

**Model:** sonnet — перенос трёх однотипных фетчеров по шаблону query-стора из Technical Details

**Files:**

- Modify: `src/entities/movie/api/getMovies.ts`, `src/entities/movie/api/getPopularMovies.ts` + тесты
- Modify: `src/entities/movie/hooks/{useTopRatedMovies,useNewMovies,usePopularMovies}.ts` + тесты, `src/entities/movie/hooks/index.ts`, `src/entities/movie/index.ts`
- Modify: `src/pages/home/ui/{PopularMoviesRail,TrandingSeriesRail,TopAnimeRails,PersonalRails}/*.tsx` (хуки рейлов вызываются здесь), `src/pages/home/ui/Home/Home.tsx`, `src/pages/popular/ui/Popular/Popular.tsx` + тесты

- [ ] фетчеры `getMovies`/`getPopularMovies` становятся чистыми функциями запроса (маппинг DTO и проверка error-DTO — как есть) + экземпляр `createQueryStore` рядом; popular — `ttlMs` 24 ч
- [ ] хуки возвращают `QueryResult`; экспорты `invalidate*` удаляются из хуков и barrel-файлов (Retry = `refetch`)
- [ ] `QueryBoundary` принимает `query` пропом, поэтому хук и boundary переезжают внутрь каждого компонента-рейла; `Home.tsx` перестаёт оборачивать рейлы в `AsyncBoundary`. Скелетоны и `EmptyState` при пустом результате сохраняются
- [ ] lazy-mount и `content-visibility` рейлов не ломаем (`performance.md`): запрос рейла стартует при монтировании рейла, как сейчас; `widgets/movie-rail` данных не читает и не меняется
- [ ] тесты сторов через MSW: успех, 403 (сообщение о лимите), пустой результат
- [ ] тесты страниц: скелетон → данные, ошибка → Retry перезапрашивает
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 11: Query-сторы детальных страниц (movie, person)

**Model:** sonnet — перенос фетчеров, правила 404/images зафиксированы в `data-layer.md` и тестах

**Files:**

- Modify: `src/entities/movie/api/{getMovieDetail,getMovieImages}.ts`, `src/entities/movie/hooks/useMovieDetail.ts` + тесты
- Modify: `src/entities/person/api/getPersonDetail.ts`, `src/entities/person/hooks/usePersonDetail.ts`, `src/entities/person/hooks/index.ts` + тесты
- Modify: `src/entities/movie/api/getMoviesByIds.ts` (временный мост до Task 12), `src/entities/movie/index.ts`
- Modify: `src/pages/movie/MoviePage.tsx`, `src/pages/person/PersonPage.tsx` + тесты

- [ ] стор «только detail по id» (`movieDetailStore`) — базовый; его `fetch()` переиспользуют бандл и `getMoviesByIds`
- [ ] стор бандла фильма: `fetcher` = `Promise.allSettled([movieDetailStore.fetch(id), fetchMovieImages(id)])` — detail обязательно через стор, иначе кеш с `getMoviesByIds` не общий и квота тратится вдвое; images отклонился → `images: []`, страница рендерится; detail отклонился (включая 404) → ошибка
- [ ] мост: старый `getMoviesByIds` (ещё на `createCachedFetcher`) переключается с `getMovieDetail(id)` на `movieDetailStore.fetch(id)` — его потребители до Task 12 продолжают работать
- [ ] стор персоны; `ApiError.status` доступен в `error` — 404-вид отличается от общей ошибки
- [ ] `MoviePage`/`PersonPage`: `QueryBoundary` с `errorFallback`, различающим 404
- [ ] смена `:id` в URL: показывается скелетон нового id, а не данные предыдущего (`keepPreviousData` не включаем)
- [ ] тесты: успех, 404, частичный отказ images, смена id
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 12: Query-стор `getMoviesByIds` и страницы списков

**Model:** sonnet — логика `allSettled`/404 переносится как есть, шаблон композиции через `fetch()` задан планом

**Files:**

- Modify: `src/entities/movie/api/getMoviesByIds.ts` + тест
- Modify: `src/features/{favorites,watched,watchlist}/model/use*Movies.ts` + тесты
- Modify: `src/pages/{favorites,watched,watchlist}/ui/**` + тесты
- Modify: `src/pages/recommendations/model/useRecommendedMovies.ts` (временный мост до Task 14), `src/entities/movie/index.ts`

- [ ] новый `moviesByIdsStore`: `fetcher` обходит id через `movieDetailStore.fetch(id)` + `Promise.allSettled`; 404-id молча выпадает; ключ — массив id
- [ ] старый экспорт `getMoviesByIds` (кеширующий фетчер) не удаляется до Task 14; мост: `useRecommendedMovies` временно читает избранное через `use(getMoviesByIds(ids))` вместо `useFavoriteMovies()`, чтобы typecheck и тесты рекомендаций оставались зелёными
- [ ] `useFavoriteMovies`/`useWatchedMovies`/`useWatchlistMovies` возвращают `QueryResult<Movie[]>`; пустой список id → `skip`, хук сам подставляет `data: []` (иначе `QueryBoundary` покажет fallback)
- [ ] страницы: `QueryBoundary`, пустые состояния сохраняются; при удалении карточки сетка не мигает скелетоном (`keepPreviousData`), а `data` фильтруется по текущим `ids` — удалённая карточка исчезает сразу, не дожидаясь нового ключа
- [ ] тесты: общий кеш с детальной страницей (второго запроса нет), 404-id отфильтрован, пустой список, Retry
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 13: Каталог и поиск — пагинация и stale-while-fetching

**Model:** opus — обход курсора через вложенные `fetch()` и удержание прежней сетки на `/search`: много решений, ошибки неочевидны

**Files:**

- Modify: `src/entities/movie/api/{getMoviesPage,getSearchMovies}.ts` + тесты
- Modify: `src/pages/search/model/{useMovieCatalog,useCatalogUpdateStatus}.ts` + тесты
- Modify: `src/pages/search/ui/Search/Search.tsx` + тест, `src/entities/movie/index.ts`

- [ ] сторы шага курсора и страницы каталога (`catalogPageStore`) по схеме из Technical Details; текстовый поиск — чистая `fetchSearchMovies` без стора; `toTotalPages`, `MAX_PAGE`, «курсор кончился раньше» — без изменений в поведении
- [ ] старые экспорты `getMoviesPage`/`invalidateMoviesPage` остаются рядом с новым стором до Task 14 — на них ещё стоят рекомендации
- [ ] единый стор каталога в `src/pages/search/model/`: `fetcher` выбирает ветку `fetchSearchMovies` / `catalogPageStore.fetch`; `useMovieCatalog` — один `useQuery` с `keepPreviousData`
- [ ] `useCatalogUpdateStatus`: убрать зеркало `useState` + `useDeferredValue`, `isUpdating` = `isFetching && !isLoading`; если хук вырождается в одну строку — удалить его вместе с тестом и связанным правилом в `search-catalog.md` (правка правила — в Task 19). Пагинация по-прежнему подсвечивает клик мгновенно (live-значение `page` из URL)
- [ ] `usePageSync`, `useFilterState`, `useSearchAnalytics` не трогаем
- [ ] первый заход — скелетон; смена страницы/фильтра/режима — прежняя сетка с бейджем «Updating…»; ошибка — `ErrorState` с Retry
- [ ] тесты: обход курсора переиспользует закешированные шаги (счётчик сетевых запросов), последняя страница и `total = 0`, переключение режима держит прежние данные, 403
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 14: Рекомендации

**Model:** sonnet — дизайн стора задан планом (один стор, цепочка в `fetcher`), тесты переписываются под него

**Files:**

- Create: `src/pages/recommendations/model/recommendationsStore.ts`, `src/pages/recommendations/model/recommendationsStore.test.ts`
- Modify: `src/pages/recommendations/model/useRecommendedMovies.ts`; `useRecommendedMovies.test.tsx` переписать (сейчас написан под Suspense), `useRecommendedMovies.retry.test.tsx` удалить (проверяет удаляемый `invalidateRecommendations`)
- Modify: `src/pages/recommendations/ui/Recommendations/Recommendations.tsx` + тест
- Modify: `src/entities/movie/api/{getMoviesByIds,getMoviesPage}.ts`, `src/entities/movie/index.ts` (снять мосты Task 12–13)

- [ ] `recommendationsStore` с ключом `ids`: `fetcher` = `moviesByIdsStore.fetch(ids)` → `computeRecommendationQuery` → `null` (пустое избранное/нет правила, без сетевого запроса) либо `catalogPageStore.fetch({ params, page: 1 })` → `Movie[]`
- [ ] `useRecommendedMovies`: `ids` из `useFavorites` → `recommendationsStore.useQuery(ids)`; возвращает один `QueryResult<Movie[] | null>`. Пока идёт загрузка — скелетон, а не empty-state
- [ ] module-level переменная последнего запроса и `invalidateRecommendations` удаляются — Retry = `refetch` (перезапрос упавшего вложенного шага обеспечивает семантика `fetch()` из Task 8)
- [ ] исключение `favoriteIds` из выдачи и отсутствие favorite-toggle на карточках сохраняются
- [ ] снять мосты: удалить старые кеширующие экспорты `getMoviesByIds`, `getMoviesPage`, `invalidateMoviesPage` и их записи в barrel
- [ ] тесты: пустое избранное → `null` без запроса; изменение избранного → новый запрос; ошибка загрузки избранного и ошибка каталога → `ErrorState`, Retry перезапрашивает упавший шаг; `null` vs `[]`
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 15: Справочники жанров и стран на сторе с persist

**Model:** opus — нужно совместить persist прежнего формата с 7-дневным TTL, фоновым обновлением и кулдауном: детали остаются за исполнителем

**Files:**

- Modify: `src/entities/movie/api/{createDictionaryCache,genreDictionaryCache,countryDictionaryCache}.ts` + тесты
- Modify: `src/entities/movie/hooks/{useGenreDictionary,useCountryDictionary}.ts` + тесты
- Modify: `src/test/setup.ts`

- [ ] `createDictionaryCache` строит стор на `createPersistedStore` поверх прежнего слота (`{ items, fetchedAt }`, прежние ключи — уже сохранённые справочники пользователей читаются)
- [ ] хуки остаются синхронными: кеш отдаётся сразу, протухание лишь запускает фоновое обновление
- [ ] кулдаун 60 с, in-flight дедупликация и защита от пустого ответа сохраняются; кулдаун не персистится
- [ ] `resetGenreDictionaryState`/`resetCountryDictionaryState` в `setup.ts` заменяются общим `resetAllStores()`: in-memory кулдаун, in-flight и счётчик поколений сбрасываются через собственный `registerStoreReset`
- [ ] `invalidateGenreDictionary` (потребителей вне тестов нет) удалить вместе с тестами на него
- [ ] тесты: чтение сохранённого кеша, фоновое обновление по TTL, кулдаун после ошибки, пустой ответ не затирает кеш, параллельные потребители дают один запрос
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 16: Удаление старого data-layer

**Model:** sonnet — удаление по списку, knip/typecheck/тесты ловят ошибки

**Files:**

- Delete: `src/shared/lib/cachedFetcher/**`, `src/shared/lib/sessionCache/**`
- Delete: `src/shared/ui/AsyncBoundary/**`, `src/shared/lib/storage/useStorageSlot.ts`
- Modify: `src/shared/lib/index.ts`, `src/shared/lib/storage/index.ts`, `src/shared/ui/index.ts`, `src/test/setup.ts`
- Modify: комментарии с упоминанием удалённых механизмов в `src/app/GlobalErrorBoundary{,.test}.tsx`, `src/app/layouts/AppLayout{,.test}.tsx`, `src/shared/ui/ErrorBoundary/*.test.tsx`, `src/features/catalog-filter/ui/GenreSelector/GenreSelector.tsx`, `e2e/movie-detail.spec.ts`, `e2e/recommendations.spec.ts`

- [ ] grep по `createCachedFetcher`, `createSessionCache`, `resetAllCachedFetchers`, `AsyncBoundary`, `useStorageSlot`, `invalidate[A-Z]`, `[^.a-zA-Z]use(` — потребителей не осталось (шаблон `use(` исключает `interceptors.response.use(` в `src/shared/api/client.ts` и `server.use(` в тестах)
- [ ] `createStorageSlot` остаётся (backend для persist, `chunkPreloadRecovery`, `sentry`)
- [ ] удалить модули и экспорты из barrel-файлов; `setup.ts`: убрать `resetAllCachedFetchers`
- [ ] обновить комментарии в коде и e2e (только комментарии, сценарии не меняются)
- [ ] тесты удалённых модулей удаляются вместе с ними; новых тестов задача не добавляет — проверка: весь набор зелёный
- [ ] `make knip` — без новых находок
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 17: Бюджеты бандла и замер разницы с `main` и `rtk`

**Model:** sonnet — измерение и обновление чисел, `make size` показывает результат

**Files:**

- Modify: `package.json` (`size-limit`)
- Create: `docs/concepts/zustand-bundle-diff.md`

- [ ] `VITE_SENTRY_DSN=https://k@o1.ingest.sentry.io/1 make build-only && make size` на ветке (без DSN чанк `entry` получается меньше реального — `build-budgets.md`); записать gzip-размеры всех чанков
- [ ] цифры `main` — той же командой в отдельном worktree; цифры `rtk` — из `git show rtk:docs/concepts/rtk-bundle-diff.md`
- [ ] обновить лимиты `entry`/`vendor`/`shared`/`page-*`: измеренный gzip + 15% (`.claude/rules/build-budgets.md`)
- [ ] проверить, что `zustand` попал в `vendor`, а `devtools` middleware отсутствует в прод-сборке
- [ ] таблица diff по чанкам `main` / `rtk` / `zustand` в `docs/concepts/zustand-bundle-diff.md`
- [ ] тестов кода нет; `make size` — зелёный

### Task 18: Verify acceptance criteria

**Model:** sonnet — сверка результата с планом и критериями Phase 3, исправление расхождений

- [ ] все пункты roadmap 3.2 реализованы, отклонения по фильтрам отражены в README
- [ ] в `src/` нет React-`use(` для данных (grep `[^.a-zA-Z]use(`), `createCachedFetcher`, `useStorageSlot`, `AsyncBoundary`
- [ ] ключи и формат `localStorage` те же, что на `main` (`kinoshka:*`, голый JSON); `index.html` и CSP-хэш не изменены
- [ ] одного «гигантского» стора нет: каждая фича и каждый запрос — отдельный стор
- [ ] job `branch-guard` присутствует в `ci.yml` ветки и содержит `zustand` в `BLOCKED_BRANCHES` на `main`
- [ ] `make check` (format-check, lint, build)
- [ ] `make test`
- [ ] `make knip`, `make size`
- [ ] `make e2e` — один прогон (квота 200 запросов/день); сценарии спеков не менялись

### Task 19: [Final] Документация

**Model:** sonnet — документация описывает уже построенное поведение

**Files:**

- Modify: `README.md`
- Modify: `.claude/rules/{data-layer,storage,build-budgets,search-catalog}.md`, `AGENTS.md`
- Modify: `plans/roadmap.md`

- [ ] `README.md`: раздел ветки `zustand` — разбор паттернов (изолированные сторы, persist поверх слота с прежним форматом, откат неудачной записи, `useShallow`, фабрика query-сторов и композиция через `fetch()`, отсутствие провайдера), плюсы/минусы, что потеряно относительно `main`, сравнение с `rtk`, таблица bundle-size из Task 17
- [ ] `README.md`: почему фильтры каталога не в сторе (URL — источник истины) и почему самописный query-кеш — учебная конструкция, а production-вариант — TanStack Query (roadmap 3.7)
- [ ] `README.md`: пометка, что ветка не предназначена для слияния в `main`
- [ ] `.claude/rules/data-layer.md` (на английском): заменить разделы про `createCachedFetcher`/`AsyncBoundary`/`invalidate*` на решения ветки — только неочевидное и причины, без пересказа кода; обновить `paths:` под новые файлы
- [ ] `.claude/rules/storage.md` (на английском): сторы как единственные читатели слотов, откат при неудачной записи, пропуск собственных уведомлений
- [ ] `build-budgets.md`, `search-catalog.md`: поправить упоминания удалённых механизмов
- [ ] `AGENTS.md`: раздел «Data (summary)», строки таблицы топиков, gotcha про `useDeferredValue` (если больше не применима в коде — убрать)
- [ ] `plans/roadmap.md`: отметить `[x]` пункты 3.2 (с пометкой об отклонении по `useFiltersStore`). Отметки останутся только в ветке `zustand` — на `main` roadmap не меняется (так же у `rtk`); учесть при сборке таблицы 3.8
- [ ] перенести этот план в `docs/plans/completed/` (при запуске через `/planning:exec` перенос делает харнес — тогда пункт пропустить)

## Post-Completion

**Запрет слияния в `main`**

- `branch-guard` — стоп-кран уровня CI: PR `zustand → main` получает красный обязательный check. На момент планирования job числится required в ruleset `protect-main`, обходящих акторов нет (проверено через `gh api` при ревью плана)
- ограничение механизма: guard сверяет только имя head-ветки. PR из ветки с другим именем он не остановит — в том числе feature-ветку от `zustand`, открытую без `--base zustand`. Если нужна жёсткая гарантия, ужесточить guard: проверять в merge-ref наличие `zustand` в `package.json` или маркер-файл ветки
- ветку `zustand` не удалять после завершения — она нужна для таблицы roadmap 3.8

**Ручная проверка**

- Redux DevTools (через `devtools` middleware, DEV): видны отдельные сторы `favorites`/`theme`/`watched`/`watchlist`/`profile`/`searchUi` и query-сторы с записями по ключам (критерий Phase 3 «DevTools видит state-tool артефакты»)
- смена темы без вспышки при перезагрузке (инлайн-скрипт и стор читают один ключ)
- данные существующего пользователя (избранное, списки, тема, имя профиля), сохранённые на `main`, читаются веткой без потерь
- две вкладки: изменение избранного/темы в одной отражается в другой
- `/search`: при смене страницы/фильтра старая сетка остаётся на экране с индикатором обновления; шторки фильтров закрыты после ухода и возврата на страницу
- приватный режим/переполненный `localStorage`: избранное не «залипает» в UI, `/profile` показывает ошибку сохранения

**Наблюдать после миграции**

- расход квоты API в DEV: без `sessionStorage`-кеша каждая перезагрузка страницы перезапрашивает данные
- при появлении roadmap 3.8 — перенести таблицу bundle diff в README `main`
