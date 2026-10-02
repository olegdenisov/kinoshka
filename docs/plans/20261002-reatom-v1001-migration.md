# Миграция на Reatom v1001 (полный стек): state, async, routing

## Overview

Ветка `reatom` — сравнительная ветка фазы 3 роадмапа (`plans/roadmap.md`, пункт 3.3). Пункт 3.3
написан под Reatom v3 (`@reatom/framework`, `@reatom/npm-react`, `reatomAsync`/`reatomResource`);
этот план реализует его на **Reatom v1001** (`@reatom/core@^1001.3.0` + `@reatom/react@^1001.0.1`)
и в максимальной глубине — «полный Reatom-стек»:

- **client state** — `createStorageSlot` + `useSyncExternalStore` → атомы с persist;
- **server state** — `createCachedFetcher` + `use()` + Suspense-`AsyncBoundary` →
  `computed(async) + withAsyncData`, `action + withAsync + withCache`, loaders роутов;
- **URL state** — `useSearchParams` → `urlAtom`;
- **routing** — React Router → `reatomRoute` (layout-роут, loaders, `render`).

Соответствие чекбоксам 3.3 (v3 → v1001):

| 3.3 (v3)                                       | v1001                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `pnpm add @reatom/framework @reatom/npm-react` | `pnpm add @reatom/core @reatom/react`                                        |
| Atoms на каждое поле, actions для мутаций      | `atom` / `reatomEnum` + именованные `action`; чтение `a()`, запись `a.set()` |
| `reatomAsync` / `reatomResource`               | `action().extend(withAsync())` / `computed(async).extend(withAsyncData())`   |
| Memoized derived atoms                         | `computed`: `favoriteIdSet`, `activeChips`, `recommendationQuery`, `resolvedTheme`, `isUpdating` |
| README ветки                                   | раздел в `README.md` — Task 18                                               |

Ветка **никогда не мержится в `main`** (CI-блок `32694a8`), поэтому совместимость формата
`localStorage` с `main` не требуется.

## Context (from discovery)

- **Client state (5 слотов):** `src/features/{favorites,watched,watchlist,theme,profile}/model/*Storage.ts`
  + хуки `use*.ts` поверх `src/shared/lib/storage/{storage,useStorageSlot}.ts`. Репортер ошибок
  хранилища подключён в `src/app/sentry.ts` (`setStorageErrorReporter`). Тот же `createStorageSlot`
  используют словари: `src/entities/movie/api/createDictionaryCache.ts`,
  `src/entities/movie/hooks/{useGenreDictionary,useCountryDictionary}.ts`.
- **Потребители `useFavorites()`:** `MovieRail`, `RelatedMovies`, `SearchResultsGrid`, страницы
  `Favorites`, `Popular`, `Recommendations`, `Watched`, `Watchlist`, `Profile`. `Card`
  (`@entities/movie`) получает `isFavorite` / `onToggleFavorite` пропсами — entities не может
  импортировать features.
- **Server state:** `src/shared/lib/cachedFetcher/`, `src/shared/lib/sessionCache/`, fetcher'ы
  `src/entities/movie/api/get*.ts`, `src/entities/person/api/getPersonDetail.ts`, хуки
  `src/entities/{movie,person}/hooks/*`, `use*Movies.ts` в `features/{favorites,watched,watchlist}`,
  `src/pages/recommendations/model/useRecommendedMovies.ts`, `src/shared/ui/AsyncBoundary/`.
  `getMoviesByIds` уже ходит через `getMovieDetail` — сетка избранного и `/movie/:id` делят один
  кэш по id.
- **Rails главной (4 ресурса):** `PersonalRails` → top rated, `TopAnimeRails` → top rated
  `type: ['anime']`, `TrandingSeriesRail` → new `type: ['tv-series']`, `PopularMoviesRail` → popular.
  `MovieRail` принимает готовые `items`.
- **URL state:** `src/features/catalog-filter/model/useFilterState.ts`,
  `src/pages/search/model/{useMovieCatalog,usePageSync,useCatalogUpdateStatus,useSearchAnalytics}.ts`,
  `src/pages/search/ui/Search/Search.tsx`, `src/widgets/header/ui/Header/Header.tsx`,
  `src/pages/home/ui/HeroSection/HeroSection.tsx`.
- **Routing:** `src/app/router.tsx`, `src/app/providers.tsx`, `src/app/layouts/AppLayout.tsx`,
  `src/app/sentry.ts` (`reactRouterBrowserTracingIntegration`), `src/app/sentry-bootstrap.ts`,
  `src/main.tsx`; `react-router` импортируется в 21 прод-файле (52 с тестами; в тестах 169
  `MemoryRouter` + 7 `createMemoryRouter` в 31 файле).
- **Сопутствующее:** inline-скрипт темы в `index.html` (читает `kinoshka:theme` напрямую, дефолт
  `'system'`; его sha256 зашит в CSP — `vercel.json`, `vercel-headers.test.ts`); 22 тестовых файла
  сидят `localStorage.setItem` в сыром формате; `src/test/setup.ts` импортирует
  `resetGenreDictionaryState` / `resetCountryDictionaryState` / `resetAllCachedFetchers`;
  `size-limit` в `package.json`, `bundle.config.ts`, `knip.jsonc`. e2e-спеки `localStorage`
  напрямую не читают и не пишут.
- **Проверенные факты об API** (по `.d.ts` и `index.js` пакетов):
  - Persist пишет **конверт** `PersistRecord` `{ data, id, timestamp, version, to }`. Опции:
    `key`, `schema` (Standard Schema), `version`, `migration`, `subscribe` (по умолчанию `true`),
    `time`, `toSnapshot`, `fromSnapshot`.
  - ⚠️ `time` по умолчанию — `2 ** 31 - 1` мс (~24,8 дня): запись с истёкшим `to` удаляется при
    чтении. `Infinity` не подходит — сериализуется в `null`. Handbook (`v1001.reatom.dev/handbook/persist`)
    заявляет дефолт `Number.MAX_SAFE_INTEGER` («навсегда»), но код и `.d.ts` версии 1001.3.0
    используют `MAX_SAFE_TIMEOUT` — документация и пакет расходятся, верить коду.
  - ⚠️ `schema` при невалидных данных **бросает** `TypeError` из чтения атома. Невалидный JSON и
    значение без конверта безопасно дают дефолт.
  - ⚠️ Сбой записи в `withLocalStorage` проглатывается внутри (`console.warn`), наружу не выходит;
    при недоступном `localStorage` значение молча живёт в памяти. Handbook это подтверждает:
    «If storage.set() throws, atom still updates in memory», ошибка только в консоли.
  - `withCache({ staleTime (5 мин), length (**5 записей**), swr, paramsToKey, withPersist })`.
  - `urlAtom`: `.go(path, replace)`, `.set(fn, replace)`, `.catchLinks` (включён по умолчанию;
    пропускает `target=_blank`, чужой origin, `download`, клики с модификаторами), `.sync` /
    `.syncFromSource` (интеграция с внешним роутером; эхо от `syncFromSource` обратно в `sync` не
    уходит), `.routes`.
  - `reatomRoute({ path, params, search, loader, render, layout })`; `route.render()`,
    `route.outlet()` (массив), `route.loader.{data,ready,error,retry,status}`.
  - ⚠️ `is404` при layout-роуте без пути всегда `false` — такой роут матчит любой URL.
  - `withAsyncData({ status: true })`; `isFirstPending` — поле `status()`. Async-computed без
    зависимостей не пересчитывается сам. `retry` у action-ресурса требует `cacheParams: true`.
  - `memo` допустим в рендере `reatomComponent`, но использует только первый переданный колбэк.
  - `@reatom/react`: `reatomComponent`, `reatomFactoryComponent`, `useAtom`, `useAction`, `useWrap`,
    `bindField`, `reatomContext`. Тесты: `context.start()`, `context.reset()`, `createMemStorage`, `mock`.

## Development Approach

- **testing approach**: Regular (код, затем тесты); существующие тесты — страховочная сетка.
  Поведенческие тесты (RTL, e2e) должны остаться зелёными с правкой только обвязки. Тесты
  реализации удаляемых модулей удаляются вместе с модулем и заменяются тестами моделей.
- завершать каждую задачу полностью, прежде чем начинать следующую; маленькие сфокусированные изменения
- **CRITICAL: каждая задача обязана включать новые/обновлённые тесты** для своего кода
- **CRITICAL: `make test` и `make typecheck` зелёные перед переходом к следующей задаче**
- **CRITICAL: обновлять этот файл при изменении объёма работ**
- React Router и Reatom сосуществуют до Task 12 через временный мост (Task 8) — поэтому сборка и
  тесты зелёные после каждой задачи, а не только в конце
- `make size` в CI будет красным между Task 1 и Task 16 (в `vendor` одновременно лежат обе
  библиотеки) — в Task 1 лимит `vendor` временно поднимается, окончательные лимиты — в Task 16
- коммит на каждую задачу, conventional commits, scope = FSD-слой

### Конвенции Reatom для этой ветки (обязательны во всех задачах)

- Все атомы / actions / computed **именованы**, имена цепочкой через точку: `'favorites.ids'`,
  `'favorites.toggle'`. Фабрики — с префиксом `reatom*`.
- Чтение — вызов без аргументов, запись — `.set(...)`. Не заводить «identity»-actions, которые
  только прокидывают значение в `atom.set`.
- Идемпотентное чтение данных — `computed(async () => …).extend(withAsyncData())`; команды и
  запросы с параметрами — `action(async …).extend(withAsync(), withCache())`. Никаких `effect` +
  ручной fetch на mount.
- `await wrap(promise)` на каждой async-границе; не чейнить после `wrap`; внешние колбэки —
  `wrap(fn)` или `onEvent`. Внутри хуков Reatom (`withCallHook` и т.п.) колбэки **не** оборачивать.
- Компоненты, читающие атомы, — `reatomComponent(fn, 'Name')`; обработчики событий — `wrap(...)`.
  Объявление — `const Foo = reatomComponent<FooProps>(({ p }) => …, 'Foo')`, типы пропов — `type`.
- `memo` в рендере — только когда замыкание не зависит от меняющихся пропов; иначе `key={id}` на
  компоненте.
- Suspense — только для lazy-чанков страниц. Данные рендерятся по статусу (`ready`/`error`/`data`).
- `effect` — только с явным временем жизни (loader роута, init-action, скоуп компонента), не на
  уровне модуля.
- Persist — нативный `withLocalStorage`, всегда с двумя опциями: `time: Number.MAX_SAFE_INTEGER` и
  `schema` с `.catch(fallback)` (причины — решение 9).
- FSD не меняется: модели живут в `model/` своего слайса, экспорт через `index.ts`; route-атомы —
  в `app`, нижние слои строят ссылки через `@shared/config` (см. ниже).
- WHY-комментарии в коде — на русском; правила в `.claude/rules/*.md` и `AGENTS.md` — на английском.

## Testing Strategy

- **unit**: обязательны в каждой задаче. Модели тестируются без React — в `context.start(() => …)`
  с MSW; компоненты — через `renderWithReatom`.
- **Обвязка тестов меняется в три шага.** Task 1–7: `renderWithReatom(ui)` даёт только фрейм
  Reatom, существующие `MemoryRouter` в тестах остаются. Task 8: появляется опция `url` — внутри
  memory-router + мост. Task 11: все тесты переведены на `url`. Task 12: внутренняя реализация
  `url` меняется на чистый `urlAtom`, сами тесты не трогаются.
- **e2e (Playwright, живой API, квота 200 запросов/сутки)**: спеки не переписываются. Из-за квоты
  e2e запускается **два раза за план**: Task 13 и Task 17.
- **`make size` / `make knip`**: бюджеты пересчитываются один раз в Task 16.

## Progress Tracking

- отмечать выполненное `[x]` сразу
- новые задачи — с префиксом ➕, блокеры — с ⚠️
- при отклонении от плана — править план

## Solution Overview

### Слои и размещение

```
src/shared/config/paths.ts          билдеры путей: paths.movie(id), paths.search(params) …
src/shared/ui/AsyncState/           статусный рендер loading / error / empty / data
src/entities/movie/model/           rails-ресурсы, fetchMovieDetail, словари
src/entities/person/model/          fetchPersonDetail
src/features/*/model/               атомы client state + actions
src/features/catalog-filter/model/  фильтры как computed над URL + actions записи
src/pages/search/model/             catalog-ресурс, синхронизация страницы, аналитика
src/pages/recommendations/model/    query → ресурс
src/app/routes.tsx                  layoutRoute + 10 page-роутов (params, loader, render)
```

### Ключевые решения

1. **Route-атомы живут в `app`, нижние слои их не импортируют.** `loader` и `render` задаются
   только при создании роута, а им нужны entities и страницы. Нижним слоям хватает трёх вещей:
   ссылки — `<a href={paths.movie(id)}>` (`urlAtom.catchLinks` делает клик SPA-навигацией);
   императивная навигация — `urlAtom.go(paths.search(...))`; чтение query — `urlAtom()`.
   Единственность шаблонов путей гарантирует тест в `app`.
2. **Данные страницы с параметром — loader роута, передаётся странице пропом**
   (`render: self => <MoviePage detail={self.loader} />`). Loader вызывает кэшируемый action из
   entities.
3. **Данные без параметров — глобальные `computed + withAsyncData` в `entities`.** Четыре rail-ресурса
   главной и `/popular`. Результат живёт всю SPA-сессию; повтор — только `.retry()`.
4. **Кэш запросов с параметрами — `withCache` на action, с явным `length`.** Дефолтные 5 записей
   хуже нынешнего неограниченного кэша: деталь фильма — 100, персона — 50, страницы каталога и
   поиска — 50. `staleTime` — дефолтные 5 минут (как `CACHE_TTL_MS` сейчас). В DEV кэш переживает
   reload через `withPersist: withSessionStorage` — замена `createSessionCache`.
5. **Один кэшируемый `fetchMovieDetail` на всё приложение.** Его используют и id-списки (Task 6),
   и loader `/movie/:id` (Task 14) — как сейчас `getMoviesByIds` и страница делят
   `getMovieDetail`. Иначе переход из избранного на страницу фильма начал бы стоить запрос.
6. **Кэш ошибок (20s cooldown) удаляется.** Он существовал из-за нестабильного промиса в `use()`.
   В статусной модели ошибка лежит в `.error()` до явного `.retry()`.
7. **`/search`: URL — единственный источник правды, читается единообразно.** `filters`, `query`,
   `page`, `sort` — `computed` над `urlAtom()` (существующие чистые парсеры и Zod сохраняются);
   запись — actions поверх `urlAtom.set(fn, true)`. `withSearchParams` не используется: его
   двусторонняя синхронизация дописывает дефолты в URL (`?page=1`, `?q=`) и конфликтует с
   computed-чтением фильтров.
8. **«Старые данные на экране при обновлении» — без `useDeferredValue`.** `withAsyncData` хранит
   предыдущее `data()`, `AsyncState` с `keepPrevious` его показывает; `isUpdating` — computed.
9. **Persist — нативный `withLocalStorage`, без своей обёртки** (решение пользователя). Две его
   ловушки закрываются нативными же опциями в каждой модели: `time: Number.MAX_SAFE_INTEGER`
   (handbook называет это дефолтом, фактический дефолт пакета — ~25 дней) и `schema` с
   `.catch(fallback)` (иначе невалидные данные роняют чтение атома). Третья не закрывается: сбой
   записи наружу не выходит. **Принятые следствия относительно `main`:** сбои хранилища больше не
   репортятся в Sentry (остаётся `console.warn` от Reatom); `favorite added` отправляется без
   проверки, что запись сохранилась; `/profile` не показывает пользователю сбой записи.
10. **Точечные подписки карточек не делаются.** Списки читают `favoriteIdSet()` и передают
    `isFavorite` в `Card` пропом, как сейчас; лишние рендеры карточек срезает React Compiler.
    Отдельный connected-виджет карточки — лишний слой ради демонстрации.
11. **React Compiler остаётся включённым**; способ совместить его с чтением атомов в рендере
    фиксируется spike'ом в Task 1.
12. **Chrome-конфиг `AppLayout` остаётся таблицей по `pathname`** (из `urlAtom`), а не выводится из
    route-атомов — иначе `AppLayout` ↔ `routes.tsx` дают циклический импорт.
13. **«Не найдено» — свой computed, не `is404`:** ни один page-роут не совпал точно.
14. **Sentry-трейсинг роутов — вручную:** `browserTracingIntegration({ instrumentNavigation: false,
    instrumentPageLoad: false })` + `startBrowserTracingPageLoadSpan` /
    `startBrowserTracingNavigationSpan` с именем-шаблоном (`/movie/:id`) и `source: 'route'`.

### Порядок работ

Сначала то, что не зависит от роутера (client state → async-ресурсы → словари), затем временный
мост `urlAtom ↔ React Router`, под ним переводится URL-state и тесты, и только потом роутер
меняется одним шагом. Страницы `/movie/:id` и `/person/:id` остаются на старом fetch-слое до
Task 14, чтобы не переписывать их дважды.

## Technical Details

**Client state:**

```ts
// src/features/favorites/model/favorites.ts
export const favoriteIds = atom<number[]>([], 'favorites.ids').extend(
  withLocalStorage({
    key: 'kinoshka:favorites',
    schema: z.array(z.number()).catch([]),
    time: Number.MAX_SAFE_INTEGER,
  }),
)
export const favoriteIdSet = computed(() => new Set(favoriteIds()), 'favorites.idSet')
export const toggleFavorite = action((id: number) => { … }, 'favorites.toggle')
```

Read-modify-write внутри action читает атом напрямую — гонки двух записей в одном тике, из-за
которой хуки читали `slot.get()`, больше нет.

**Async-ресурс и статусный рендер:**

```tsx
<AsyncState
  resource={topRatedMovies}          // AsyncDataExt со status: true
  skeleton={<MovieRailSkeleton />}
  isEmpty={movies => movies.length === 0}
  empty={<EmptyState … />}
  keepPrevious                        // при повторном запросе показывать прошлые данные
>
  {movies => <MovieRail items={movies} />}
</AsyncState>
```

Без `keepPrevious` скелетон показывается при любом pending (нужно для `/movie/1 → /movie/2`);
с ним — только при `status().isFirstPending` (нужно для `/search`).

**Роуты:**

```tsx
// src/app/routes.tsx
export const layoutRoute = reatomRoute({ layout: true, render: self => <AppLayout>{self.outlet()}</AppLayout> })
export const movieRoute = layoutRoute.reatomRoute({
  path: 'movie/:id',
  params: z.object({ id: z.string().regex(/^\d+$/).transform(Number) }),
  loader: async ({ id }) => await wrap(fetchMovieDetail(id)),
  render: self => <MoviePage detail={self.loader} />,
})
```

Корень приложения — `reatomComponent(() => layoutRoute.render(), 'App')` внутри `GlobalErrorBoundary`.

**Persist-формат:** значение в `localStorage` — конверт `{ data, … }`. Inline-скрипт темы в
`index.html` читает `JSON.parse(raw).data`; его sha256 в CSP пересчитывается.

## What Goes Where

- **Implementation Steps** — всё, что делается в этом репозитории: код, тесты, правила, README.
- **Post-Completion** — ручная проверка в браузере, Sentry, замеры для сводной таблицы 3.8.

## Implementation Steps

### Task 1: Установка Reatom, тестовая обвязка, spike по React Compiler

**Model:** opus — оставляет открытым решение по Compiler, на котором стоят все следующие задачи

**Files:**

- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/app/reatom-setup.ts`
- Modify: `src/main.tsx`
- Modify: `src/test/setup.ts`
- Create: `src/test/renderWithReatom.tsx`
- Create: `src/test/reatom-compiler.test.tsx`
- Modify: `vite.config.ts` (только если spike потребует исключения в конфиге компилятора)
- Modify: `docs/plans/20261002-reatom-v1001-migration.md` (запись результата spike)

- [ ] `pnpm add @reatom/core@^1001.3.0 @reatom/react@^1001.0.1`
- [ ] создать `src/app/reatom-setup.ts`: `connectLogger()` только при `import.meta.env.DEV`; импортировать в `src/main.tsx` сразу после `./app/sentry-bootstrap` (он остаётся первым импортом)
- [ ] `src/test/setup.ts`: `context.reset()` в `afterEach`; убедиться тестом, что состояние persist-атома не протекает между тестами
- [ ] создать `src/test/renderWithReatom.tsx`: `renderWithReatom(ui)` — `context.start()` + `reatomContext.Provider`, возвращает результат RTL и `frame`. Роутером не управляет: тесты Task 2–7 оставляют свои `MemoryRouter`
- [ ] **spike Compiler**: тест с `reatomComponent`, читающим `atom()` в рендере, собранный через тот же babel-пресет, что и прод (`reactCompilerPreset`): обновляется ли значение на экране после `atom.set()`. Проверить и на `make build-only`
- [ ] по результату зафиксировать **одно** правило в разделе «Результат spike»: (а) ничего не нужно; (б) директива `'use no memo'` в теле каждого `reatomComponent`; (в) исключение в конфиге компилятора. При (б)/(в) — добавить проверку, которая падает при нарушении (lint-правило или тест)
- [ ] оставить в `reatom-compiler.test.tsx` регрессионный тест на выбранное правило
- [ ] временно поднять лимит `vendor` в `size-limit` (`package.json`) с комментарием «до Task 16»
- [ ] `make test && make typecheck` — зелёные

### Task 2: Модель favorites на `withLocalStorage`

**Model:** opus — задаёт паттерн модели и опций persist, который копируют Task 3, 4, 7

**Files:**

- Create: `src/test/seedPersist.ts`
- Create: `src/features/favorites/model/favorites.ts`, `src/features/favorites/model/favorites.test.ts`
- Delete: `src/features/favorites/model/favoritesStorage.ts`, `src/features/favorites/model/useFavorites.ts` (+ их тесты)
- Modify: `src/features/favorites/index.ts`
- Modify: потребители `useFavorites()` — `src/widgets/movie-rail/ui/MovieRail/MovieRail.tsx`, `src/pages/movie/ui/RelatedMovies/RelatedMovies.tsx`, `src/pages/search/ui/SearchResultsGrid/SearchResultsGrid.tsx`, `src/pages/{favorites,popular,recommendations,watched,watchlist,profile}/ui/**`, `src/features/favorites/model/useFavoriteMovies.ts` (+ тесты)

- [ ] создать `favorites.ts`: `favoriteIds` с `withLocalStorage({ key: 'kinoshka:favorites', schema: z.array(z.number()).catch([]), time: Number.MAX_SAFE_INTEGER })`, `favoriteIdSet`, actions `toggleFavorite` / `addFavorite` / `removeFavorite` / `clearFavorites`
- [ ] у `time` — WHY-комментарий: handbook называет `MAX_SAFE_INTEGER` дефолтом, фактический дефолт пакета — ~25 дней; у `.catch([])` — что без него невалидные данные роняют чтение атома
- [ ] `trackEvent('favorite added')` — при добавлении, без проверки результата записи (сбой записи в нативном persist не наблюдаем — принятое следствие, решение 9)
- [ ] перевести потребителей на `reatomComponent`: читают `favoriteIdSet()`, в `Card` передают `isFavorite` / `onToggleFavorite` пропсами как сейчас. `Card.tsx` не трогать
- [ ] `src/test/seedPersist.ts`: `seedPersist(key, data)` — кладёт в `localStorage` валидный конверт; заменить им сырые `localStorage.setItem('kinoshka:favorites', …)` в тестах
- [ ] тесты persist-поведения модели: запись через 30 дней по fake timers читается; `data` не по схеме → `[]` без исключения; невалидный JSON → `[]`; `setItem` бросает `QuotaExceededError` → значение живёт в памяти, приложение не падает; `getItem` бросает `SecurityError` → `[]`; обновление из другого таба
- [ ] тесты модели в `context.start`: toggle/add/remove/clear, два toggle в одном тике
- [ ] обновить компонентные тесты потребителей на `renderWithReatom`
- [ ] `make test && make typecheck` — зелёные

### Task 3: Модели watched и watchlist

**Model:** sonnet — повторяет паттерн Task 2, тесты ловят расхождения

**Files:**

- Create: `src/features/watched/model/watched.ts`, `src/features/watchlist/model/watchlist.ts` (+ `.test.ts`)
- Delete: `src/features/watched/model/{watchedStorage,useWatched}.ts`, `src/features/watchlist/model/{watchlistStorage,useWatchlist}.ts` (+ тесты)
- Modify: `src/features/watched/index.ts`, `src/features/watchlist/index.ts`, потребители (`grep -rn "useWatched()\|useWatchlist()" src`)

- [ ] создать обе модели по образцу `favorites.ts` — **три независимых файла, без общей фабрики**: `.claude/rules/user-lists.md` требует дублирования структуры вместо общей абстракции
- [ ] перевести потребителей на `reatomComponent`
- [ ] заменить сырые сиды `localStorage` этих ключей в тестах на `seedPersist`
- [ ] тесты моделей (success + сбой хранилища + независимость списков друг от друга и от favorites)
- [ ] обновить компонентные тесты
- [ ] `make test && make typecheck` — зелёные

### Task 4: Модели theme и profile

**Model:** sonnet — спецификация ясна; CSP-хэш и FOUC покрыты тестом и e2e

**Files:**

- Create: `src/features/theme/model/theme.ts`, `src/features/profile/model/profile.ts` (+ `.test.ts`)
- Delete: `src/features/theme/model/{themeStorage,useTheme}.ts`, `src/features/profile/model/{profileStorage,useProfile}.ts` (+ тесты)
- Modify: `src/features/theme/index.ts`, `src/features/profile/index.ts`, потребители
- Modify: `src/app/reatom-setup.ts`
- Modify: `index.html`, `vercel.json`, `vercel-headers.test.ts`

- [ ] `theme.ts`: атом темы `'light' | 'dark' | 'system'` (через `reatomEnum`, начальное значение — явно `'system'`, не первый вариант списка) + `withLocalStorage` с теми же двумя опциями, что в Task 2; `systemPrefersDark = reatomMediaQuery('(prefers-color-scheme: dark)')`; `resolvedTheme` (computed); применение `data-theme` на `<html>` — из init-action, вызываемого в `reatom-setup.ts`
- [ ] `index.html`: inline-скрипт читает `JSON.parse(raw).data`, дефолт `'system'`; пересчитать sha256 в CSP (`vercel.json`) — `vercel-headers.test.ts` должен это подтвердить
- [ ] `profile.ts`: имя пользователя — один `reatomField` с валидацией (без `reatomForm`) + `bindField` в UI; показ сбоя записи на `/profile` убирается вместе с его тестом (решение 9)
- [ ] защиту PII не трогать: `data-sentry-component` на `ProfileAvatar` и `PROFILE_ARIA_LABEL_PREFIX`
- [ ] заменить сырые сиды `localStorage` этих ключей в тестах на `seedPersist`
- [ ] тесты: theme (три значения, `system` следует за media query, persist, кросс-таб), profile (валидация, persist)
- [ ] обновить компонентные тесты темы и профиля
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 5: Статусный `AsyncState` и ресурсы без параметров (home rails, popular)

**Model:** opus — определяет интерфейс `AsyncState` и паттерн ресурса, на которых строятся Task 6, 9, 14

**Files:**

- Create: `src/shared/ui/AsyncState/index.tsx`, `src/shared/ui/AsyncState/AsyncState.test.tsx`
- Modify: `src/shared/ui/index.ts`
- Create: `src/entities/movie/model/rails.ts` (+ `.test.ts`)
- Modify: `src/entities/movie/api/getMovies.ts`, `src/entities/movie/api/getPopularMovies.ts` (+ тесты)
- Delete: `src/entities/movie/hooks/{useTopRatedMovies,useNewMovies,usePopularMovies}.ts` (+ тесты)
- Modify: `src/entities/movie/hooks/index.ts`, `src/entities/movie/index.ts`
- Modify: `src/pages/home/ui/{PersonalRails,TopAnimeRails,TrandingSeriesRail,PopularMoviesRail}/*.tsx`, `src/pages/popular/**`

- [ ] `AsyncState` — `reatomComponent`: пропы `resource`, `skeleton`, `isEmpty?`, `empty?`, `errorFallback?`, `keepPrevious?`, `children(data)`. Читает `resource.status()`
- [ ] семантика `keepPrevious`: `false` (по умолчанию) — скелетон при любом pending; `true` — скелетон только при `isFirstPending`, дальше прошлые данные
- [ ] ошибка → `ErrorState` с `onRetry={wrap(resource.retry)}`; кнопка Retry неактивна, пока идёт запрос (замена `isRetryingRef`)
- [ ] `AsyncState` не зависит от роутера; старый `AsyncBoundary` остаётся до Task 14
- [ ] `getMovies.ts`, `getPopularMovies.ts`: убрать `createCachedFetcher`, оставить чистые функции «параметры → Promise»; проверка error-DTO (`'statusCode' in response.data` → `ApiError`) сохраняется
- [ ] `rails.ts`: четыре ресурса — `topRatedMovies`, `topRatedAnime` (`type: ['anime']`), `newSeries` (`type: ['tv-series']`), `popularMovies` — `computed(async).extend(withAsyncData({ initState: [], status: true }))`
- [ ] перевести четыре rail-обёртки главной и `Popular` на `reatomComponent` + `AsyncState`; `MovieRail` по-прежнему принимает `items`; lazy-mount и `content-visibility` (`.claude/rules/performance.md`) не менять
- [ ] тесты `AsyncState`: pending → skeleton, данные, пустой результат, ошибка → retry делает новый запрос, `keepPrevious` в обоих значениях
- [ ] тесты `rails.ts` через MSW: success, 403 (квота) → `error()`, `retry()` после ошибки, unmount до ответа → повторный mount получает данные
- [ ] обновить тесты страниц home/popular
- [ ] `make test && make typecheck` — зелёные

### Task 6: Кэшируемая деталь фильма, id-списки и рекомендации

**Model:** sonnet — паттерн задан в Task 5, поведение покрыто существующими тестами

**Files:**

- Create: `src/entities/movie/model/movieDetail.ts` (+ `.test.ts`)
- Modify: `src/entities/movie/api/getMoviesByIds.ts`, `src/entities/movie/index.ts`
- Create: `src/features/favorites/model/favoriteMovies.ts`, `src/features/watched/model/watchedMovies.ts`, `src/features/watchlist/model/watchlistMovies.ts`
- Delete: `src/features/favorites/model/useFavoriteMovies.ts`, `src/features/watched/model/useWatchedMovies.ts`, `src/features/watchlist/model/useWatchlistMovies.ts` (+ тесты)
- Create: `src/pages/recommendations/model/recommendedMovies.ts`
- Delete: `src/pages/recommendations/model/useRecommendedMovies.ts` (+ тест)
- Modify: страницы `src/pages/{favorites,watched,watchlist,recommendations}/`

- [ ] `movieDetail.ts`: `fetchMovieDetail` — `action(async (id: number) => …).extend(withAsync(), withCache({ length: 100 }))`, в DEV `withPersist: withSessionStorage`. Только деталь, без картинок. Старый `getMovieDetail` на `createCachedFetcher` остаётся для `/movie/:id` до Task 14
- [ ] `fetchMoviesByIds(ids)` — `Promise.allSettled` поверх `fetchMovieDetail` (404'нутый id молча выпадает, как сейчас)
- [ ] `favoriteMovies` / `watchedMovies` / `watchlistMovies` — `computed(async () => fetchMoviesByIds(ids()))` + `withAsyncData({ initState: [], status: true })`
- [ ] `recommendedMovies.ts`: `recommendationQuery = computed(() => computeRecommendationQuery(favoriteMovies.data()))` (чистая функция не меняется) → ресурс. Модульная переменная «последний query для retry» удаляется — `.retry()` пересчитывает computed сам
- [ ] правило про карточки `/recommendations` сохраняется: без favorite-кнопки, с watchlist-кнопкой
- [ ] перевести четыре страницы на `AsyncState` с `keepPrevious` (удаление одного фильма не мигает скелетоном)
- [ ] тесты: кэш по id (второй вызов без запроса; 6+ разных id не вытесняют друг друга), частичный отказ, пустой список → empty state, пересчёт рекомендаций при изменении favorites
- [ ] `make test && make typecheck` — зелёные

### Task 7: Словари жанров и стран, удаление `createStorageSlot`

**Model:** opus — механику TTL и фоновой перезагрузки нужно спроектировать заново на persist-атомах

**Files:**

- Create: `src/entities/movie/model/dictionaries.ts` (+ `.test.ts`)
- Delete: `src/entities/movie/api/{createDictionaryCache,genreDictionaryCache,countryDictionaryCache}.ts`, `src/entities/movie/hooks/{useGenreDictionary,useCountryDictionary}.ts` (+ тесты)
- Delete: `src/shared/lib/storage/` целиком
- Modify: `src/entities/movie/api/{getGenreDictionary,getCountryDictionary}.ts`, `src/entities/movie/index.ts`, `src/shared/lib/index.ts`
- Modify: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.tsx` и остальные потребители словарей
- Modify: `src/test/setup.ts`, `src/app/sentry.ts`

- [ ] перед началом прочитать `.claude/rules/search-catalog.md` (раздел про жанры) и существующий `createDictionaryCache.ts` — инварианты и семантика TTL/cooldown оттуда обязательны
- [ ] `genreDictionary`, `countryDictionary` на атомах с `withLocalStorage`; срок жизни словаря — нативная опция `time` (здесь TTL и есть нужное поведение), `schema` с `.catch(fallback)`
- [ ] сохранить поведение: пока словарь не загружен или запрос упал — UI работает на статическом fallback, без skeleton и без ErrorState; фоновая перезагрузка не чаще раза в 60s
- [ ] перевести потребителей на `reatomComponent`
- [ ] `src/test/setup.ts`: убрать `resetGenreDictionaryState` / `resetCountryDictionaryState` (их заменяет `context.reset()`)
- [ ] удалить `src/shared/lib/storage/` и репортер ошибок хранилища (`setStorageErrorReporter`) из `sentry.ts` вместе с его тестами — замены нет (решение 9); `grep -rn "createStorageSlot\|useStorageSlot\|useSyncExternalStore" src` — пусто
- [ ] тесты: чтение из persist без запроса, истёкший срок → запрос, ошибка → fallback, cooldown
- [ ] `make test && make typecheck && make lint` — зелёные

### Task 8: Временный мост `urlAtom` ↔ React Router, билдеры путей, обвязка тестов

**Model:** opus — двунаправленная синхронизация, ошибка порядка даёт откат URL или потерю записи истории

**Files:**

- Create: `src/shared/config/paths.ts` (+ `.test.ts`), экспорт в `src/shared/config/index.ts`
- Create: `src/app/urlBridge.ts` (+ `.test.ts`)
- Modify: `src/app/router.tsx`
- Modify: `src/test/renderWithReatom.tsx`

- [ ] `paths.ts`: `home()`, `movie(id)`, `person(id)`, `search(params?)`, `favorites()`, `watched()`, `watchlist()`, `popular()`, `recommendations()`, `profile()`; `search()` принимает готовый `URLSearchParams` — собрать его сам через `filtersToSearchParams` он не может, та функция живёт в `@features/catalog-filter` (импорт вверх по слоям)
- [ ] `urlBridge.ts`: `connectUrlBridge(router)` — принимает любой инстанс роутера. Роутер → атом: `router.subscribe` → `urlAtom.syncFromSource(...)`, URL собирать из `router.state.location`, **не** из `window.location` (иначе мост не работает с memory-router в тестах)
- [ ] синхронизировать только при `state.navigation.state === 'idle'` и изменившемся `location` — промежуточные состояния навигации несут старый URL и откатили бы `urlAtom`
- [ ] атом → роутер: `urlAtom.sync.set((url, replace) => router.navigate(url.pathname + url.search + url.hash, { replace }))`; `urlAtom.catchLinks.set(false)` — пока ссылками управляет React Router
- [ ] подключить мост в `router.tsx` сразу после создания роутера; пометить файл комментарием «временно, удаляется в Task 12»
- [ ] `renderWithReatom(ui, { url })`: при переданном `url` поднимает `createMemoryRouter` с `ui` как единственным роутом `*` + `RouterProvider` + `connectUrlBridge`; начальный URL попадает в `urlAtom` до первого рендера. Без `url` — поведение Task 1
- [ ] тесты моста на `createMemoryRouter`: навигация роутера обновляет `urlAtom`; `urlAtom.go` / `urlAtom.set(fn, true)` двигает роутер с правильным push/replace; back/forward; нет двойных записей истории; `urlAtom.set` во время pending-навигации не откатывается
- [ ] тесты `paths.ts` и `renderWithReatom({ url })`
- [ ] `make test && make typecheck` — зелёные

### Task 9: `/search` — фильтры, каталог, синхронизация страницы

**Model:** opus — ошибка порядка синхронизации проходит свои проверки, поведение общее для `Header` и `AppLayout`

**Files:**

- Create: `src/features/catalog-filter/model/filters.ts` (+ `.test.ts`)
- Delete: `src/features/catalog-filter/model/useFilterState.ts` (+ тест)
- Modify: `src/features/catalog-filter/index.ts`, UI слайса `src/features/catalog-filter/ui/**`
- Modify: `src/entities/movie/api/{getMoviesPage,getSearchMovies}.ts`
- Create: `src/pages/search/model/catalog.ts` (+ `.test.ts`)
- Delete: `src/pages/search/model/{useMovieCatalog,usePageSync,useCatalogUpdateStatus}.ts` (+ тесты)
- Modify: `src/pages/search/model/useSearchAnalytics.ts`, `src/pages/search/ui/**`
- Modify: `src/widgets/search-sidebar/**`

- [ ] перед началом прочитать `.claude/rules/search-catalog.md` целиком
- [ ] `filters.ts`: `filters = computed(() => getFilterFromSearchParams(new URLSearchParams(urlAtom().search)))`; `activeChips` (computed); actions `setFilters` / `resetFilters` / `removeChip` — пишут через `urlAtom.set(fn, true)` + `filtersToSearchParams`. Чистые `lib/`-функции и Zod-схема не меняются
- [ ] `catalog.ts`: `query`, `page`, `sort` — тоже `computed` над `urlAtom()`, запись — actions через `urlAtom.set(fn, true)`; дефолты в URL не пишутся (нет `?page=1`, `?q=`); `page` clamp'ится к `MAX_PAGE` на чтении и на записи
- [ ] `getMoviesPage` / `getSearchMovies` → cached actions (`withAsync` + `withCache({ length: 50 })`, в DEV `withPersist: withSessionStorage`); курсорная эмуляция нумерованных страниц в `getMoviesPage` остаётся как есть
- [ ] `catalog = computed(async …).extend(withAsyncData({ status: true }))`: есть `q` → search-эндпоинт, нет → каталог с фильтрами; `isUpdating` — computed
- [ ] правила синхронизации — в одном месте: вход в текстовый режим атомарно снимает фильтры и сортировку из URL **одной** записью; смена `q`/фильтров/сортировки сбрасывает `page` в 1
- [ ] deep-link / refresh сразу с `q` + фильтрами — обрабатывать `effect` со скоупом страницы: `withChangeHook` на инициализацию не срабатывает
- [ ] `Search` и дочерние — `reatomComponent`, результаты через `AsyncState` с `keepPrevious`; пагинация подсвечивает страницу мгновенно (читает `page`, не данные); вилка `useViewport()` в `Search.tsx` остаётся
- [ ] аналитика поиска — со скоупом страницы; события и условия те же
- [ ] тесты моделей: два режима, снятие фильтров одной записью истории, deep-link с `q` + фильтрами, сброс страницы, clamp, отсутствие дефолтов в URL, `isUpdating`, back/forward восстанавливает фильтры
- [ ] обновить тесты `Search`, сайдбара, чипов на `renderWithReatom({ url })`
- [ ] `make test && make typecheck` — зелёные

### Task 10: Поисковый ввод в `Header` и `HeroSection`

**Model:** sonnet — небольшой объём, поведение покрыто тестами

**Files:**

- Create: `src/widgets/header/model/searchInput.ts` (+ `.test.ts`)
- Modify: `src/widgets/header/ui/Header/Header.tsx`, `src/widgets/header/index.ts`
- Modify: `src/pages/home/ui/HeroSection/HeroSection.tsx`
- Delete: `src/shared/lib/debounce/` — если после задачи не осталось потребителей

- [ ] `searchInput.ts`: атом черновика ввода + action записи в URL с debounce через `withAbort()` + `await wrap(sleep(QUERY_DEBOUNCE_MS))`; `trim`, `QUERY_MIN_LENGTH`, очистка (×) — как сейчас; на странице не `/search` ввод ведёт на `paths.search(...)`
- [ ] черновик синхронизируется из URL при внешней смене `q` (back/forward, клик по чипу)
- [ ] `HeroSection`: сабмит → `urlAtom.go(paths.search(...))`, тот же `QUERY_MIN_LENGTH`
- [ ] текст запроса по-прежнему не попадает в `aria-label`/`title`/`name` (`.claude/rules/sentry.md`)
- [ ] вилку `useViewport()` в `AppLayout` не трогать; обновить её WHY-комментарий (эффект записи `?q` больше не живёт в компоненте)
- [ ] тесты модели: debounce (последний ввод побеждает), короткий запрос не пишется, очистка, синхронизация из URL
- [ ] обновить тесты `Header`, `HeroSection` на `renderWithReatom({ url })`
- [ ] `make test && make typecheck` — зелёные

### Task 11: Перевод всех тестов на `renderWithReatom({ url })`

**Model:** sonnet — механическая замена обёртки, сбой виден сразу

**Files:**

- Modify: все тестовые файлы с `MemoryRouter` / `createMemoryRouter` (`grep -rln "MemoryRouter\|createMemoryRouter" src`), кроме `src/app/router.test.tsx` и `src/app/urlBridge.test.ts`

- [ ] заменить `<MemoryRouter initialEntries={[x]}>` на `renderWithReatom(ui, { url: x })`; прод-код не менять
- [ ] тесты, проверявшие навигацию через роутер (`createMemoryRouter` + проверка `location`), проверяют `urlAtom()` 
- [ ] `grep -rn "MemoryRouter" src` — остаётся только в `renderWithReatom.tsx`, `router.test.tsx`, `urlBridge.test.ts`
- [ ] `make test && make typecheck` — зелёные, число тестов не уменьшилось

### Task 12: Замена React Router на `reatomRoute`

**Model:** opus — меняет поведение, общее для всех слоёв (навигация, layout), и удаляет мост

**Files:**

- Create: `src/app/routes.tsx`, `src/app/routes.test.tsx`
- Delete: `src/app/router.tsx`, `src/app/router.test.tsx`, `src/app/urlBridge.ts` (+ тест)
- Modify: `src/app/providers.tsx`, `src/app/providers.test.tsx`, `src/app/layouts/AppLayout.tsx` (+ тест), `src/app/sentry.ts`, `src/app/sentry-bootstrap.ts`, `src/main.tsx`
- Modify: оставшиеся импортёры `react-router` — `src/entities/movie/ui/Card/Card.tsx`, `src/features/profile/ui/ProfileAvatar/ProfileAvatar.tsx`, `src/pages/movie/{MoviePage.tsx,ui/MovieHero,ui/tabs/CastTab,ui/tabs/OverviewTab}`, `src/pages/person/{PersonPage.tsx,ui/Filmography/CreditGroup}`, `src/pages/profile/ui/Profile/Profile.tsx`, `src/widgets/mobile-chrome/ui/{BottomNav,MobileHeader}`, `src/widgets/movie-rail/ui/MovieRail/MovieRail.tsx`, `src/widgets/header/ui/Header/Header.tsx`
- Modify: `src/test/renderWithReatom.tsx`, `package.json`

- [ ] `routes.tsx`: `layoutRoute` (`layout: true`) + 10 page-роутов; страницы по-прежнему через `lazyNamed`; для `/movie/:id` и `/person/:id` — `params` с Zod (`\d+` → number)
- [ ] элементы `self.outlet()` рендерить с `key`
- [ ] на этом шаге detail-страницы получают `id` пропом (`render: self => <MoviePage id={self().id} />`) и остаются на старом fetch-слое — loaders в Task 14
- [ ] `isNotFound = computed(() => pageRoutes.every(route => !route.exact()))` — не `is404`; при `isNotFound()` layout показывает `ErrorState` «Page not found» со ссылкой на главную. Покрывает и неизвестный путь, и `/movie/abc`
- [ ] `providers.tsx`: `<GlobalErrorBoundary><App /></GlobalErrorBoundary>`, где `App = reatomComponent(() => layoutRoute.render(), 'App')`
- [ ] `AppLayout`: принимает `children` вместо `<Outlet/>`; `ROUTE_CHROME` остаётся таблицей по `pathname` из `urlAtom`, `/movie/:id` и `/person/:id` матчатся по шаблону пути без импорта `routes.tsx`; `activeNav` на `/search` — из `?type`; `key` per-route `ErrorBoundary` — `pathname`; `<Suspense>` для чанков остаётся; кнопка «назад» — `history.back()`
- [ ] `trackPageview()` — на смену `pathname` (не `search`), читая `urlAtom`
- [ ] `<ScrollRestoration />` удаляется; замена — в Task 13
- [ ] все `<Link to>` → `<a href={paths.…}>`; `useNavigate` → `urlAtom.go`; `useParams`/`useLocation`/`useMatch` — убрать. Стретч-ссылка `Card` и правило «карточка не рендерит ссылку без текста» (`.claude/rules/ui-patterns.md`) сохраняются
- [ ] `urlAtom.catchLinks` включён (дефолт); мост и `catchLinks.set(false)` удалены
- [ ] `sentry.ts`: `reactRouterBrowserTracingIntegration` → `browserTracingIntegration()` (имена транзакций временно сырые — правится в Task 15); убрать `wrapCreateBrowserRouter`; обновить WHY-комментарии в `main.tsx`/`sentry-bootstrap.ts` (bootstrap остаётся первым импортом — `Sentry.init` должен опередить первую навигацию)
- [ ] `renderWithReatom({ url })`: внутри — `history.replaceState` + `urlAtom`, без memory-router; тесты компонентов не меняются
- [ ] `routes.test.tsx`: каждый URL рендерит свою страницу внутри layout; `route.path(params) === paths.x(params)` для всех 10 роутов (для роутов с Zod-схемой id передаётся **строкой**); невалидный id и неизвестный путь → not found; сбой lazy-чанка → per-route fallback с retry
- [ ] тесты `AppLayout`: chrome по роутам, сброс границы при смене `pathname`, pageview не срабатывает на смену query
- [ ] `pnpm remove react-router`; `grep -rn "react-router" src` — пусто
- [ ] `make check && make test` — зелёные

### Task 13: Восстановление скролла и первый e2e-прогон

**Model:** sonnet — узкая спецификация, e2e ловит регрессии навигации

**Files:**

- Create: `src/app/scrollRestoration.ts` (+ `.test.ts`)
- Modify: `src/app/reatom-setup.ts`

- [ ] `scrollRestoration.ts`: `history.scrollRestoration = 'manual'`; новая запись истории → `scrollTo(0, 0)`; back/forward → восстановить сохранённую позицию по ключу записи; смена только query на `/search` (replace) скролл не трогает
- [ ] клик по ссылке на текущий URL: `catchLinks` пушит дубль записи истории — проверить тестом и, если подтверждается, гасить (перехватчик, который игнорирует навигацию на тот же URL)
- [ ] подключить из init-action в `reatom-setup.ts`
- [ ] тесты: push → top, back → сохранённая позиция, replace query → без изменений, ссылка на текущий URL не плодит записи
- [ ] `make test && make typecheck` — зелёные
- [ ] `make build-only && make e2e` (первый из двух e2e-прогонов плана; спеки не менять — расхождение означает регрессию поведения)

### Task 14: Loaders для `/movie/:id` и `/person/:id`, удаление старого fetch-слоя

**Model:** sonnet — паттерны заданы в Task 5, 6 и 12, поведение покрыто тестами страниц

**Files:**

- Create: `src/entities/movie/model/movieImages.ts`, `src/entities/person/model/personDetail.ts` (+ `.test.ts`)
- Modify: `src/entities/movie/api/{getMovieDetail,getMovieImages}.ts`, `src/entities/person/api/getPersonDetail.ts`
- Delete: `src/entities/movie/hooks/` и `src/entities/person/hooks/` целиком (+ тесты)
- Delete: `src/shared/lib/cachedFetcher/`, `src/shared/lib/sessionCache/`, `src/shared/ui/AsyncBoundary/`
- Modify: `src/shared/lib/index.ts`, `src/shared/ui/index.ts`, `src/entities/{movie,person}/index.ts`, `src/test/setup.ts`
- Modify: `src/app/routes.tsx`, `src/pages/movie/**`, `src/pages/person/**`

- [ ] перед началом прочитать `.claude/rules/data-layer.md` (раздел `/movie/:id`, `/person/:id`)
- [ ] `fetchMovieImages(id)` — отдельный cached action (`length: 100`); `fetchPersonDetail(id)` — cached action (`length: 50`). Деталь фильма — уже существующий `fetchMovieDetail` из Task 6, второй кэш не заводить
- [ ] loader `/movie/:id`: `Promise.allSettled([fetchMovieDetail(id), fetchMovieImages(id)])`; отказ картинок → `images: []`, отказ детали (включая 404) → reject
- [ ] `routes.tsx`: `loader` для двух роутов; страницы получают `detail={self.loader}` вместо `id`
- [ ] `MoviePage`/`PersonPage` — `AsyncState` **без** `keepPrevious` (смена `/movie/1 → /movie/2` показывает skeleton, не прошлый фильм) с `errorFallback`, различающим 404 (`ApiError.status`) и прочие ошибки
- [ ] `RelatedMovies` (lazy-mount через `IntersectionObserver`) — свой ресурс, запрос только после появления в viewport
- [ ] удалить `cachedFetcher`, `sessionCache`, `AsyncBoundary`, `resetAllCachedFetchers` из `src/test/setup.ts`; `grep -rnE "createCachedFetcher|AsyncBoundary|[^.]\buse\(" src` — в прод-коде пусто
- [ ] тесты: success, 404, отказ картинок, кэш (возврат на тот же id без запроса; переход из избранного на страницу фильма без запроса детали), уход со страницы до ответа
- [ ] обновить `MoviePage.test.tsx`, тесты `PersonPage`
- [ ] `make test && make typecheck` — зелёные

### Task 15: Sentry-трейсинг роутов

**Model:** opus — имена транзакций не проверяются существующими тестами, ошибка тихо ломает группировку в Sentry

**Files:**

- Create: `src/app/sentryRouting.ts` (+ `.test.ts`)
- Modify: `src/app/sentry.ts`, `src/app/sentry.test.ts`, `src/app/routes.tsx`

- [ ] чистая функция `getTransactionName(routes, url)` → шаблон совпавшего page-роута (`/movie/:id`), для not-found — `'/*'`
- [ ] `sentry.ts`: `browserTracingIntegration({ instrumentPageLoad: false, instrumentNavigation: false })`
- [ ] `sentryRouting.ts`: `startBrowserTracingPageLoadSpan` при старте и `startBrowserTracingNavigationSpan` на смену `pathname`, оба с `name` = шаблон и `sentry.source = 'route'`; смена только query нового span не создаёт
- [ ] подключение — после `Sentry.init`, no-op когда Sentry выключен (не PROD или нет DSN)
- [ ] PII-скрабберы (`beforeBreadcrumb`/`beforeSendSpan`) и `captureRouteError` не менять
- [ ] тесты: `getTransactionName` для всех 10 роутов + not-found; с моком клиента Sentry — pageload-span один, navigation-span на смену пути, нет span на смену query
- [ ] `make test && make typecheck` — зелёные

### Task 16: Бюджеты бандла, code splitting, knip

**Model:** sonnet — механическая процедура из `.claude/rules/build-budgets.md`, результат проверяют `make size`/`make knip`

**Files:**

- Modify: `bundle.config.ts` (+ тест), `package.json` (`size-limit`), `knip.jsonc`
- Modify: `docs/plans/20261002-reatom-v1001-migration.md` (таблица размеров)

- [ ] перед началом прочитать `.claude/rules/build-budgets.md`
- [ ] `bundle.config.ts`: `@reatom/*` — в `vendor`; `shared` по-прежнему перед page-группами; после сборки проверить, что entry и page-чанки импортируют только `rolldown-runtime`/`vendor`/`shared`
- [ ] пересчитать все лимиты `size-limit` (включая временно поднятый `vendor`): измеренный gzip + 15%, `entry` — со сборкой с `VITE_SENTRY_DSN`
- [ ] записать в этот план таблицу «было (main) → стало (reatom)» по каждому чанку — вход для сводной таблицы 3.8
- [ ] `make knip`: убрать ставшие лишними записи `ignore`, новые не добавлять — чинить в источнике
- [ ] обновить тест `bundle.config`
- [ ] `make build-only && make size && make knip` — зелёные

### Task 17: Проверка критериев приёмки

**Model:** sonnet — сверяет результат с планом, чинит расхождения

**Files:**

- Modify: только файлы с найденными расхождениями

- [ ] все четыре области из Overview мигрированы: `grep -rn "react-router\|createStorageSlot\|createCachedFetcher\|useSyncExternalStore\|useSearchParams" src` — пусто
- [ ] каждый вызов `withLocalStorage(` в `src` задаёт `time` и `schema` с `.catch(...)`
- [ ] `grep -rn "useMemo\|useCallback\|useDeferredValue" src` — пусто или каждое вхождение обосновано комментарием
- [ ] все атомы/actions/computed именованы; нет `effect` на уровне модуля; каждый `await` в моделях обёрнут в `wrap`
- [ ] правило по React Compiler из Task 1 соблюдено во всех `reatomComponent`
- [ ] граничные случаи: недоступный `localStorage`, 403 по квоте, 404 фильма, невалидный id в URL, неизвестный путь, back/forward на `/search`, второй таб меняет избранное
- [ ] `make check && make test && make size && make knip`
- [ ] `make build-only && make e2e` (второй и последний e2e-прогон; учитывать квоту 200 запросов/сутки)
- [ ] покрытие (`make coverage`) не ниже, чем на `main`

### Task 18: [Final] Документация

**Model:** sonnet — описывает уже построенное поведение

**Files:**

- Modify: `README.md`, `AGENTS.md`, `plans/roadmap.md`
- Modify: `.claude/rules/{data-layer,storage,search-catalog,sentry,build-budgets,analytics,ui-patterns,user-lists}.md`

- [ ] `README.md`: раздел «Reatom v1001 — разбор паттернов» (чекбокс «README ветки» из 3.3): client state, async-ресурсы, derived-атомы, роутинг; что стало проще/сложнее относительно `main`; три ловушки нативного persist (25 дней вопреки handbook, throw схемы, ненаблюдаемый сбой записи) и что из-за третьей потеряно относительно `main`; таблица размеров из Task 16
- [ ] `AGENTS.md` (англ.): Architecture (Reatom вместо React Router), Routing (`routes.tsx`, `paths`, not-found), Data summary, конвенции Reatom из этого плана; удалить устаревшие gotchas (`useDeferredValue` над `useSearchParams`, `createStorageSlot().set()` → boolean); добавить правило по React Compiler
- [ ] `.claude/rules/*.md` (англ.) — **сначала поправить `paths:` во frontmatter**: они ссылаются на удалённые файлы (`useFilterState.ts`, `useFavorites.ts`, hooks и `*DictionaryCache.ts`, `cachedFetcher`, `sessionCache`, `AsyncBoundary`, `router.tsx`), без этого правила перестанут загружаться
- [ ] содержание правил — только решения и причины, без пересказа кода: `storage.md` → две обязательные опции `withLocalStorage` и почему, принятые потери (нет репорта в Sentry, нет гейта analytics); `data-layer.md` → убрать `createCachedFetcher`/`AsyncBoundary`/`invalidate*`, добавить «ошибка не кэшируется, retry явный», «один `fetchMovieDetail`», явный `length` у `withCache`; `search-catalog.md` → URL читается через `urlAtom`, почему не `withSearchParams`, убрать правило про `areFiltersEqual`; `sentry.md` → ручные span'ы вместо `wrapCreateBrowserRouter`; `build-budgets.md` → состав vendor
- [ ] `plans/roadmap.md`: переписать пункт 3.3 под v1001 (пакеты, API, ссылки на `v1001.reatom.dev`) и отметить чекбоксы
- [ ] перенести этот план в `docs/plans/completed/`

## Результат spike (заполняется в Task 1)

- React Compiler + `reatomComponent`: _не определено_

## Post-Completion

Требуют ручных действий или внешних систем — выполняет человек, не `/planning:exec`.

**Ручная проверка:**

- [ ] пройти все 10 роутов на desktop и mobile-ширине: навигация, back/forward, восстановление скролла, обновление страницы на deep-link (`/movie/:id`, `/search?q=…&page=3`)
- [ ] тема без FOUC при reload во всех трёх режимах; favorites/watched/watchlist синхронизируются между двумя табами
- [ ] DevTools-консоль в dev: лог Reatom (`connectLogger`) читаем, имена атомов осмысленны

**Внешние системы:**

- [ ] Sentry: на preview-деплое транзакции группируются как `/movie/:id`, а не по конкретным id; Web Vitals продолжают приходить
- [ ] CSP: preview отдаёт новый хэш inline-скрипта, в отчётах нет нарушений `script-src`
- [ ] Lighthouse: прогон по лейблу `run-lighthouse` на PR ветки — сравнить с `main`
- [ ] сводная таблица 3.8 в README на `main`: bundle size и DX-заметки из README этой ветки
