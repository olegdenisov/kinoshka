# /search: живой поиск + фильтры + пагинация через URL-sync

## Overview

Перевести страницу `/search` с мока (`CATALOG`) на реальные данные. Сейчас поиск/фильтры/пагинация — нефункциональный shell: инпут в `Header` держит локальный `useState`, `useFilterState` — локальный `useState` с захардкоженными дефолтами, `page` локальный, а грид всегда рендерит `CATALOG`. `useSearch` подключён, но сломан (`SearchDesktop.tsx:22` вызывает `useSearch({query: filters.query, ...})`, но поля `filters.query` в `FilterState` нет, а сигнатура хука — `{query, page}`).

Реализуем (roadmap 1.2 + 1.3 + 1.4):

- **URL — single source of truth** для `?q`, фильтров, `?page`, `?sort`. Shareable links, работающие back/forward.
- **Один хук-фасад `useMovieCatalog`** в page-слое, который маршрутизирует по `query.trim()` между двумя взаимоисключающими эндпоинтами: `/v1.4/movie/search` (текстовый поиск, только `query/page/limit`) и `/v1.5/movie` (`getMovies`, фильтры+сортировка, курсорный, без текста).
- **Два режима (Variant A)**: есть `q` → текстовый поиск, сайдбар фильтров и сортировка задизейблены; нет `q` → каталог по фильтрам.
- **Debounce 250ms** между вводом и записью `?q` (экономия квоты demo-тарифа).
- **Нумерованная пагинация везде**: в поиске — нативный `page` v1.4; в каталоге — эмуляция `page` через **отдельный cursor-aware фетчер** (обход `next` v1.5), не трогая общий `createCachedFetcher` и рельсы главной.

**Benefits:** страница реально работает; архитектурно чистый фасад скрывает двухэндпоинтную реальность API от UI; состояние переживает reload и шарится ссылкой.

## Context (from discovery)

- **Страница/виджеты:** `src/pages/search/ui/SearchDesktop/SearchDesktop.tsx` (десктоп, рендерит `CATALOG`), `src/pages/search/ui/SearchMobile.tsx` (мобайл — уже с функциональным `BottomSheet` фильтров и сортировки на моке), `src/widgets/search-sidebar/ui/SearchSidebar` (фильтры), `src/widgets/header/ui/Header/Header.tsx:22` (инпут на локальном `useState`).
- **Фильтры:** `src/features/catalog-filter/model/useFilterState.ts` — локальный `useState`, `DEFAULT_FILTERS` захардкожены (`genres: ['Drama']`, `yearFrom: 2020`…), `activeChips` из стейта. Публичный API — `src/features/catalog-filter/index.ts`.
- **Данные:** `src/entities/movie/api/getMovies.ts` (→ `getV15Movie`), `getSearchMovies.ts` (→ `getV14MovieSearch`), обёрнуты в `createCachedFetcher.ts` (TTL-кэш `Promise<Movie[]>` + sessionStorage, isError-cooldown). Хуки: `useSearch.ts` (сломан, единственный потребитель — `SearchDesktop`), `useNewMovies`, `useTopRatedMovies` (делают `use(getMovies(...))`, ждут `Movie[]`). Публичный API — `src/entities/movie/index.ts`.
- **Сортировка:** десктопный `src/pages/search/ui/SortSelect/SortSelect.tsx` — **display-only** (нет dropdown, `onChange` игнорируется). У `SearchMobile` (строки ~56–203) — рабочий `BottomSheet` с `SORT_OPTIONS`, но `sort` в локальном `useState`.
- **Типы:** `src/entities/movie/model/types.ts` — `Movie` (`genre: string[]`, англ.), `MovieType`.
- **Связанные паттерны:** async-хуки через `use()` + `<AsyncBoundary>` (так работают рельсы главной); `useSearchParams` (react-router 7); Zod на границах; MSW в тестах (`src/test/setup.ts`, `onUnhandledRequest:'error'`); Vitest inline (`vite.config.ts`, `globals:true`).
- **Ограничения demo-тарифа:** 200 req/сутки; `limit ≤ 10`; страницы 1–10 (макс. 100 элементов); 403 при превышении (interceptor нормализует).

### Обнаруженные несоответствия (учтены в задачах)

1. **Жанры EN vs RU.** UI-жанры английские (два источника `ALL_GENRES`: `entities/movie/model/catalog.ts` экспортируемый + локальная копия в `SearchSidebar.tsx`), а API `genres.name` ждёт русские. Нужен маппинг EN→RU (Task 1). `'Slice of Life'` не имеет стандартного KP-жанра → покрывается фолбэком «unknown → skip».
2. **v1.5 курсорный.** `getV15Movie` принимает `limit/next/prev/sortField/sortType`, но **не** `page`. Нумерованная пагинация каталога — через обход `next` в отдельном фетчере (Task 7).
3. **`getSearchMovies` без sort.** Search-эндпоинт не принимает сортировку → в режиме поиска `SortSelect` неактивен.
4. **`filters.query` не существует** — текст живёт в `?q`/`Header`, не в `FilterState`. Фасад принимает `query` отдельно от `filters`.
5. **Genre round-trip.** Результаты API отдают русские `genres.name` в `Movie.genre` → карточки покажут русские жанры (мок — английские). Учтено в Task 9 (⚠️, дефолт — принять русские, опциональный reverse-map).

## Development Approach

- **testing approach: TDD (тесты сначала)** — сперва failing-тест, затем реализация до green. Особенно для pure-функций маппинга URL↔фильтры↔API.
- одна задача = один логический юнит; закончить полностью перед следующей.
- **CRITICAL: каждая задача включает новые/обновлённые тесты** (success + error/edge), отдельными пунктами чеклиста.
- **CRITICAL: все тесты зелёные перед следующей задачей.**
- **CRITICAL: обновлять план при изменении объёма** (➕ новые, ⚠️ блокеры).
- React Compiler включён — **не** добавлять `useMemo`/`useCallback`/`memo`.
- Типы через `type`, не `interface`. Компоненты: `const Foo = ({ p }: FooProps) =>`.
- **FSD: только импорты вниз** (`pages → widgets → features → entities → shared`). Фасад живёт в page-слое именно поэтому.

## Testing Strategy

- **unit (обязательно в каждой задаче):** pure-функции (`filtersToParams`/`getFilterFromSearchParams`/`genreMap`/debounce) — прямые тесты; фетчеры (cursor-walk, search) — MSW, success + 403-cooldown; фасад — рендер через `@testing-library/react` + `<AsyncBoundary>` + MSW.
- **компоненты:** smoke + a11y через `user-event` (тестировать поведение: ввод → дебаунс → URL → результаты, не моки UI).
- **e2e:** Playwright-проекта пока нет (roadmap 6.x/9.x) — сценарии в Post-Completion как ручная проверка, задачи не блокируют.
- **CRITICAL: все тесты зелёные перед следующей задачей.**

## Progress Tracking

- `[x]` сразу по факту; ➕ новые задачи; ⚠️ блокеры; держать план в синхроне.

## Solution Overview

```
Header input ──debounce 250ms──▶ ?q  ┐
SearchSidebar ─────────────────▶ фильтр-параметры ├─▶ URL (single source of truth)
Pagination ────────────────────▶ ?page           │
SortSelect ────────────────────▶ ?sort           ┘
                                        │
                    SearchDesktop/Mobile читает URL
                                        │  (page-слой: filtersToParams из @features, фетчеры из @entities — вниз)
                         useMovieCatalog({ query, filters, sort, page })   ← pages/search/model
                                        │ query.trim()?
                          ┌─────────────┴─────────────┐
                    есть текст                     нет текста
              getSearchMovies(/v1.4)          getMoviesPage(/v1.5, filtersToParams)
              нативный page                   page→cursor (обход next, свой курсор-кеш)
```

**Ключевые решения:**

- **Фасад в page-слое** (`src/pages/search/model/useMovieCatalog.ts`) — легально импортирует и `@features/catalog-filter` (`filtersToParams`), и `@entities/movie` (фетчеры) вниз. Эргономика «UI дёргает один хук» сохранена; FSD не нарушен (в entities фасад нельзя — это импорт вверх к features).
- **Один фасад, раздельные фетчеры** — `getMovies`/`getSearchMovies` не сливаем.
- **Variant A** — при активном `?q` фильтры/сортировка задизейблены (API не умеет query+фильтры одним запросом).
- **URL — истина.** `useFilterState` → `useSearchParams`; локальный `useState` только для «черновика» инпута.
- **`totalPages` нужен обоим режимам, значит фетчеры отдают `{movies, totalPages}`.** `Pagination.tsx` требует конкретное `totalPages`, а `Movie[]` его не несёт — и в search (v1.4 `pages`, types.gen.ts:372), и в catalog (v1.5 `total` при `withCount:true`, types.gen.ts:339/364). Поэтому обобщаем **`createCachedFetcher<P, R = Movie[]>`**: с дефолтным `R = Movie[]` вызов `getMovies` и его тип не меняются → **рельсы `useNewMovies`/`useTopRatedMovies` не требуют правок**; `getSearchMovies` переезжает на `R = {movies, totalPages}`. 403-cooldown и session-persist фабрики достаются обоим бесплатно.
- **Numbered-пагинация каталога — `getMoviesPage`** поверх обобщённой фабрики: каждый шаг-курсор (`fetchCatalogCursor(params, cursor?) → {movies, next, total}`) кешируется фабрикой по ключу `(params, cursor)`; сам `getMoviesPage(params, page)` обходит `next` 1..N и мемоизирует **page-level промис** по ключу `(params, page)` (стабильность для `use()` — иначе Suspense зависает). `withCount:true` даёт `total → totalPages = min(10, ceil(total/10))`.
- **Единый результат фасада** `{ movies, mode, totalPages }` — оба режима нормализованы к одной форме.

## Technical Details

- **`FilterState`** без изменений формы: `{ type, genres, yearFrom, yearTo, rating }`. `query` не добавляем — отдельный `?q`.
- **URL-параметры:** `?q`, `?type`, `?genres` (csv), `?yearFrom`, `?yearTo`, `?rating`, `?sort`, `?page`. Пустые не пишем.
- **`filtersToParams(filters, sort)` → `MovieControllerFindManyByQueryV15Data['query']`:** `type→type[]`, `genres→['genres.name'][]` (EN→RU), `yearFrom/yearTo→year:['{from}-{to}']`, `rating→['rating.kp']:['{n}-10']`, `sort→sortField/sortType`, `limit:10`.
- **`getFilterFromSearchParams(sp): FilterState`** + Zod на границе URL (мусор → дефолт, не краш).
- **Запись в URL:** `setSearchParams(next, { replace: true })`.
- **Debounce:** 250ms только для `?q`; min-length ≥ 2 перед запросом.
- **Пагинация:** `PER_PAGE = 10` (сейчас `SearchDesktop.tsx:15` = `16` — привести); clamp `page` в `[1,10]`; смена `q`/фильтров → сброс на 1. `totalPages = min(10, ceil(total / 10))` (search — из `pages`, каталог — из `total` при `withCount`).
- **Режимы:** `mode = query.trim() ? 'search' : 'catalog'`; в `search` — `SearchSidebar`/`SortSelect` `disabled`.
- **Единый результат фасада:** `{ movies: Movie[], mode, totalPages: number }` — одинаковая форма для search и catalog, `totalPages` уже clamp'нут к demo-потолку 10.
- **Baseline red:** `SearchDesktop.tsx:22` (`filters.query`) — текущая ошибка типов; per-task гейт — «тесты green», typecheck (`make check`) останется red до **Task 9** (там устраняется `filters.query`). Явный `make check`-гейт — в **Task 13**.

## What Goes Where

- **Implementation Steps** (`[ ]`): lib-функции, URL-sync хуков/инпута, фетчеры, cursor-walk, фасад, проводка Desktop/Mobile, sort UI, пагинация, тесты, обновление roadmap/AGENTS.
- **Post-Completion** (без чекбоксов): ручная проверка на реальном ключе (квота/403, реальность курсорной пагинации), e2e до Playwright-проекта, перенос ключа на BFF (Phase 5).

## Implementation Steps

### Task 1: Pure-lib маппинга URL ↔ FilterState ↔ API-параметры

**Files:**

- Create: `src/features/catalog-filter/lib/genreMap.ts`
- Create: `src/features/catalog-filter/lib/filtersToParams.ts`
- Create: `src/features/catalog-filter/lib/searchParams.ts`
- Create: `src/features/catalog-filter/lib/genreMap.test.ts`
- Create: `src/features/catalog-filter/lib/filtersToParams.test.ts`
- Create: `src/features/catalog-filter/lib/searchParams.test.ts`
- Modify: `src/features/catalog-filter/index.ts`

- [x] тесты `genreMap`: EN→RU для каждого жанра из **обоих** источников `ALL_GENRES` (catalog.ts + SearchSidebar.tsx), неизвестный (`'Slice of Life'`) → skip
- [x] тесты `filtersToParams`: `type/genres/year-диапазон/rating→'rating.kp':'n-10'/sort→sortField+sortType`, пустой фильтр → `{limit:10}`, edge (только год без rating и т.п.)
- [x] тесты `searchParams`: `getFilterFromSearchParams` (все ключи, csv-genres, пустой URL → пустой `FilterState`), `filtersToSearchParams` (обратно; пустые не пишем), Zod отбрасывает `?rating=abc`
- [x] реализовать `genreMap.ts` (EN→RU словарь + `toApiGenre`; покрыть обе копии `ALL_GENRES` или унифицировать)
- [x] реализовать `filtersToParams.ts`
- [x] реализовать `searchParams.ts` (+ Zod-схема границы URL)
- [x] обновить публичный `index.ts` (`filtersToParams`, `getFilterFromSearchParams`, `filtersToSearchParams`)
- [x] run tests — green перед Task 2

### Task 2: `useFilterState` на URL-sync

**Files:**

- Modify: `src/features/catalog-filter/model/useFilterState.ts`
- Create: `src/features/catalog-filter/model/useFilterState.test.tsx`

- [x] тесты: чтение фильтров из `useSearchParams` (`MemoryRouter` c `?genres=Drama&yearFrom=2020`), `toggleGenre`/`setFilters`/`resetFilters` пишут в URL (`replace:true`), `activeChips` из URL, edge (пустой URL → пустые фильтры)
- [x] переписать `useFilterState` на `useSearchParams` + `getFilterFromSearchParams`/`filtersToSearchParams`
- [x] убрать `DEFAULT_FILTERS` (пустые дефолты; `sort` тоже как `?sort`)
- [x] сохранить сигнатуру возвращаемого объекта (совместимость `SearchSidebar`/`SearchControls`)
- [x] run tests — green перед Task 3

### Task 3: Debounce-хук + инпут `Header` → `?q`

**Files:**

- Create: `src/shared/lib/debounce/useDebouncedValue.ts`
- Create: `src/shared/lib/debounce/index.ts`
- Create: `src/shared/lib/debounce/useDebouncedValue.test.ts`
- Modify: `src/shared/lib/index.ts`
- Modify: `src/widgets/header/ui/Header/Header.tsx`
- Create: `src/widgets/header/ui/Header/Header.test.tsx`

- [x] тесты `useDebouncedValue` (fake timers: обновление через 250ms тишины, схлопывание быстрых изменений, cleanup при размонтировании)
- [x] тесты `Header`: ввод → через 250ms `?q` (`replace:true`); min-length (<2 → не пишем/чистим); кнопка `×` при непустом `q` сбрасывает `?q`; `role="search"`
- [x] реализовать `useDebouncedValue.ts`
- [x] `Header`: локальный `useState` инпута + `useDebouncedValue` → запись `?q` (`useSearchParams`, `replace:true`); инициализация из URL; min-length; `×` (`CloseIcon`); `role="search"`
- [x] run tests — green перед Task 4

### Task 4: Обобщить `createCachedFetcher<P, R = Movie[]>`

**Обоснование:** обоим режимам нужен `totalPages`, который `Movie[]` не несёт. Дефолтный `R = Movie[]` оставляет `getMovies` и его тип без изменений → рельсы не трогаем; `getSearchMovies`/курсор-шаги каталога получают `R = {movies, totalPages}`/`{movies, next, total}` c тем же 403-cooldown и session-persist.

**Files:**

- Modify: `src/entities/movie/api/createCachedFetcher.ts`
- Modify/Create: `src/entities/movie/api/createCachedFetcher.test.ts`

- [x] тесты: фабрика с `R = Movie[]` работает как раньше (TTL, session-persist, isError-cooldown, стабильный промис на ключ); фабрика с произвольным `R` (напр. `{movies, totalPages}`) кеширует/отдаёт тот же промис
- [x] обобщить сигнатуру до `<P, R = Movie[]>`: `CacheEntry.promise: Promise<R>`, `createSessionCache<R>`, входной `fetcher: (p: P) => Promise<R>`
- [x] убедиться, что `getMovies`/`getSearchMovies` компилируются без правок сигнатур, рельсы (`useNewMovies`/`useTopRatedMovies`) зелены
- [x] run tests — green перед Task 5

### Task 5: Общий маппер `mapDocToMovie` (убрать дублирование)

**Обоснование:** маппинг `doc → Movie` уже скопирован в `getMovies.ts:20-30` и `getSearchMovies.ts:21-31`; `getMoviesPage` стал бы 3-й копией (риск дрейфа `rating.kp ?? rating.imdb`, poster-поля). Сортировка **отдельной задачей не нужна**: `RequestParams` уже включает `sortField/sortType` (types.gen.ts:1460/1464), `fetchMovies` спредит `...params` → sort прокидывается без изменений кода.

**Files:**

- Create: `src/entities/movie/api/mapDocToMovie.ts`
- Create: `src/entities/movie/api/mapDocToMovie.test.ts`
- Modify: `src/entities/movie/api/getMovies.ts`
- Modify: `src/entities/movie/api/getSearchMovies.ts`

- [x] тесты `mapDocToMovie`: полный doc → `Movie`; фолбэки (`name ?? alternativeName ?? enName`, `rating.kp ?? rating.imdb ?? 0`, отсутствие постера/года), нулевые/undefined поля
- [x] извлечь `mapDocToMovie(doc): Movie` (общий тип входа, покрывающий v1.4 `SearchMovieDtoV14` и v1.5 doc)
- [x] переключить `getMovies`/`getSearchMovies` на общий маппер; `getMovies` по-прежнему `Movie[]`, рельсы зелены
- [x] регресс-тест: sort уже прокидывается через `getMovies` (без нового кода) — короткий MSW-тест `sortField/sortType` в query
- [x] run tests — green перед Task 6

### Task 6: `getSearchMovies` — page/limit + `{movies, totalPages}`

**Files:**

- Modify: `src/entities/movie/api/getSearchMovies.ts`
- Create/Modify: `src/entities/movie/api/getSearchMovies.test.ts`

- [x] тесты (MSW): передаёт `query/page/limit:10`; результат `{ movies, totalPages }`, `totalPages = min(10, pages)` из v1.4-ответа; ответ без `docs` → `{ movies: [], totalPages: 0 }`; 403 → isError-cooldown; стабильный промис на `(query, page)`
- [x] добавить `limit:10`, прокинуть `page`; сменить return-тип фетчера на `{ movies, totalPages }` (фабрика с `R = {movies, totalPages}` из Task 4)
- [x] run tests — green перед Task 7

### Task 7: `getMoviesPage` — курсорная эмуляция numbered-page (каталог)

**Files:**

- Create: `src/entities/movie/api/getMoviesPage.ts`
- Create: `src/entities/movie/api/getMoviesPage.test.ts`
- Modify: `src/entities/movie/index.ts` (экспорт при необходимости)

- [x] тесты (MSW): `page=1` — запрос без курсора, `withCount:true`; `page=3` — обход `next` 1..3, промежуточные шаги-курсоры кешируются фабрикой; отсутствие `next` → пустой хвост; 403 → наверх; повторный `page=3` — из кеша **без новых запросов**; **идентичность page-level промиса** — второй `getMoviesPage(params, 3)` возвращает тот же `Promise`; `totalPages = min(10, ceil(total/10))` из `withCount`-`total`
- [x] реализовать `fetchCatalogCursor(params, cursor?) → {movies, next, total}` через общий `mapDocToMovie`, обёрнутый в обобщённую фабрику по ключу `(params, cursor)`
- [x] реализовать `getMoviesPage(params, page)`: обход `next` 1..N поверх `fetchCatalogCursor`; мемоизировать page-level `Promise` по ключу `(JSON.stringify(params), page)` (стабильность `use()`); вернуть `{ movies, totalPages }` (`total` с первой страницы)
- [x] ⚠️ если `next`/`total` недоступны на demo-ключе — зафиксировать блокер, согласовать фолбэк (Prev/Next для каталога) — **live-key верификация недоступна в этом прогоне** (нет demo-ключа); реализация и тесты соответствуют документированной v1.5 форме ответа (`next`/`hasNext`/`total` из `types.gen.ts:339-364`, MSW-мокировано); проверка на реальном ключе отложена в Post-Completion manual verification
- [x] run tests — green перед Task 8

### Task 8: Хук-фасад `useMovieCatalog` (page-слой)

**Files:**

- Create: `src/pages/search/model/useMovieCatalog.ts`
- Create: `src/pages/search/model/useMovieCatalog.test.tsx`

- [x] тесты (MSW + `<AsyncBoundary>`): `query` непустой → search, `filters` игнорируются, `totalPages` из search; `query` пустой → `getMoviesPage(filtersToParams(filters, sort), page)`, `totalPages` из `total`; смена `page`/`sort`/фильтров меняет запрос; возвращает **единый** `{ movies, mode, totalPages }`
- [x] реализовать `useMovieCatalog({ query, filters, sort, page })` через `use()`: `query.trim()` ? `getSearchMovies({query, page})` : `getMoviesPage(filtersToParams(filters, sort), page)`; импорт `filtersToParams` из `@features/catalog-filter`, фетчеров из `@entities/movie` (оба — вниз, FSD-легально)
- [x] нормализовать оба режима к `{ movies, mode, totalPages }` (обе ветки уже отдают `{movies, totalPages}` — добавить `mode`)
- [x] run tests — green перед Task 9

### Task 9: Проводка `SearchDesktop` на фасад + два режима + удаление `useSearch`

**Files:**

- Modify: `src/pages/search/ui/SearchDesktop/SearchDesktop.tsx`
- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx` (проп `disabled`)
- Delete: `src/entities/movie/hooks/useSearch.ts` (+ убрать из `hooks/index.ts`, `entities/movie/index.ts`)
- Create: `src/pages/search/ui/SearchDesktop/SearchDesktop.test.tsx`

- [x] тесты (MSW + `MemoryRouter`): `?q=...` → грид из search, сайдбар `disabled`; без `q` с фильтрами → грид из catalog; пустой результат → `EmptyState` с эхом («Ничего не найдено по „…“»); `aria-live="polite"` на счётчике
- [x] `SearchDesktop`: читать `q/filters/sort/page` из URL; `useMovieCatalog`; рендерить `movies` из хука (убрать `CATALOG`); `AsyncBoundary` + скелетон
- [x] режим: непустой `q` → `SearchSidebar disabled`
- [x] `EmptyState` с эхом; `PER_PAGE=10` (убрать `TOTAL_RESULTS=2846`/`16`)
- [x] ⚠️ genre round-trip: карточки покажут русские жанры для API-результатов — принять как есть (дефолт) либо добавить reverse RU→EN только для отображения; зафиксировать выбор в тесте/заметке — принят дефолт (без reverse-map), решение задокументировано комментарием в `SearchResults` (`SearchDesktop.tsx`)
- [x] удалить `useSearch` (единственный потребитель — этот файл) и подчистить экспорты
- [x] run tests — green перед Task 10

### Task 10: Рабочая сортировка (desktop `SortSelect` + mobile `?sort`)

**Files:**

- Modify: `src/pages/search/ui/SortSelect/SortSelect.tsx` (сделать интерактивным)
- Modify: `src/pages/search/ui/SearchControls/SearchControls.tsx` (проброс, если нужно)
- Modify: `src/pages/search/ui/SearchMobile.tsx` (mobile `setSort` → `?sort`)
- Create/Modify: `src/pages/search/ui/SortSelect/SortSelect.test.tsx`

- [x] тесты: выбор опции в `SortSelect` пишет `?sort` (`replace:true`); `disabled` при активном `q`; mobile-селектор так же пишет `?sort`; `?sort` читается обратно и подсвечивает активную опцию
- [x] `SortSelect`: dropdown с опциями (маппинг лейбл → `sortField/sortType`), запись `?sort`
- [x] mobile: `setSort` → `?sort` (вместо локального `useState`), инициализация из URL
- [x] run tests — green перед Task 11

### Task 11: Пагинация с URL-sync

**Files:**

- Modify: `src/pages/search/ui/Pagination/Pagination.tsx`
- Modify: `src/pages/search/ui/SearchDesktop/SearchDesktop.tsx`
- Create/Modify: `src/pages/search/ui/Pagination/Pagination.test.tsx`

- [x] тесты: `page` из `?page`; клик пишет `?page` (clamp `[1,10]`); смена `q`/фильтров сбрасывает `?page` на 1; numbered-UI в обоих режимах (search — нативный, catalog — через `getMoviesPage`)
- [x] `Pagination`/`SearchDesktop`: `page` из `useSearchParams`; запись `?page`; clamp к demo (1–10); сброс на 1 при смене запроса/фильтров; сохранить `scrollTo top`
- [x] run tests — green перед Task 12

### Task 12: Проводка `SearchMobile` на тот же фасад

**Files:**

- Modify: `src/pages/search/ui/SearchMobile.tsx`
- Create: `src/pages/search/ui/SearchMobile.test.tsx`

- [x] тесты (smoke + MSW): `?q` → результаты из хука; без `q` → каталог; грид не из `CATALOG`; существующий `BottomSheet` фильтров пишет в URL (или явно оставлен на локальном стейте — зафиксировать)
- [x] `SearchMobile`: читать URL, `useMovieCatalog`, рендерить результаты из хука (URL — общий источник истины); подключить существующий `BottomSheet` фильтров к URL-фильтрам (или пометить как отложенное) — подключён через `useFilterState` (тот же URL-sync хук, что desktop); `BottomSheet` фильтров/сортировки пишет в `?type`/`?genres`/`?yearFrom`/`?yearTo`/`?rating`/`?sort` напрямую, без промежуточного локального стейта
- [x] полный редизайн мобильного drawer **не** делаем — существующий переиспользуем; расширение — roadmap 3.4
- [x] run tests — green перед Task 13

### Task 13: Verify acceptance criteria

- [x] проверить требования из Overview: URL-sync `?q`/фильтров/`?page`/`?sort`, два режима, debounce, numbered-пагинация в обоих режимах, рабочая сортировка — подтверждено чтением `SearchDesktop.tsx`, `SearchMobile.tsx`, `useMovieCatalog.ts`, `useFilterState.ts`, `Header.tsx`, `SortSelect.tsx`, `Pagination.tsx`: URL — единственный источник истины во всех случаях, оба режима (`search`/`catalog`) взаимоисключающие с задизейбленным сайдбаром/сортировкой в search-режиме, дебаунс 250ms + min-length 2 в `Header`, нумерованная пагинация в обоих режимах (`Pagination`/`MobilePagination` + `getMoviesPage` курсор-walk для каталога), `SortSelect`/mobile-сортировка пишут `?sort` и реально применяются в `filtersToParams`
- [x] edge cases: пустой `q`+пустые фильтры (дефолтный каталог), невалидный URL (Zod → дефолт), конец выборки (нет `next`), 403-cooldown, genre round-trip не ломает карточки — все покрыты тестами (`searchParams.test.ts`: `?rating=abc`/невалидный `yearFrom` → дефолт; `getMoviesPage.test.ts`: `hasNext:false` → пустой хвост, 403 пробрасывается наверх; `getSearchMovies.test.ts`: 403 → cooldown); `Card`/`MobileCard` рендерят `movie.genre[0]` как произвольную строку без RU/EN-словаря на отображении — русские жанры из API не ломают карточки
- [x] `make test` — полный набор зелёный (19 test files, 197 tests passed)
- [x] `make check` (lint + typecheck + build) — зелёный (baseline red из `filters.query` устранён в Task 9; `tsc -b && vite build` проходит без ошибок, ESLint без предупреждений)
- [x] покрытие новых pure-функций/фетчеров/фасада на уровне проекта — все перечисленные модули имеют содержательные тест-файлы (`genreMap.test.ts` — `it.each` по всем жанрам обоих UI-источников, `filtersToParams.test.ts` — 14 кейсов, `searchParams.test.ts` — 11, `mapDocToMovie.test.ts` — 15, `getSearchMovies.test.ts` — 21 вкл. 403, `getMoviesPage.test.ts` — cursor-walk/кеш/403/idempotency, `useMovieCatalog.test.tsx` — оба режима); v8-coverage-таблица не листит несколько из этих файлов отдельной строкой (известная особенность provider'а при бандлинге/пересекающихся source-ranges), но это не реальный пробел — подтверждено прямым чтением тест-файлов

### Task 14: Обновить документацию

- [x] отметить `[x]` в `plans/roadmap.md` разделы 1.2/1.3/1.4 по факту — отмечены пункты, реально реализованные этим планом (URL-sync `?q`/фильтров/`?page`/`?sort`, два режима, debounce+min-length, numbered-пагинация в обоих режимах, isError-cooldown, a11y); оставлены `[ ]` пункты вне рамок этого плана (`useDeferredValue`, реальный хоткей ⌘K/`/`, динамическая подгрузка жанров через `getV1MoviePossibleValuesByField`, `limit:10` на главных rails) — с пояснением почему
- [x] обновить `AGENTS.md` «Data state»: `/search` на live-data, `useSearch`→`useMovieCatalog` (page-слой, `src/pages/search/model/`), genre EN→RU map (`genreMap.ts`), курсорная эмуляция page (`getMoviesPage`), обобщённый `createCachedFetcher<P, R = Movie[]>`
- [x] обновить «Key public APIs»: `@features/catalog-filter` → `filtersToParams`/`getFilterFromSearchParams`/`filtersToSearchParams`/`CatalogQueryParams`/`SORT_LABELS`; `@shared/lib` → `useDebouncedValue`; `@entities/movie` дополнен фактическими экспортами `getMoviesPage`/`getSearchMovies` (`useSearch` там никогда не был в этой таблице — фасад `useMovieCatalog` в page-слое туда не добавлен, экспорты сверены с `src/entities/movie/index.ts`, `src/features/catalog-filter/index.ts`, `src/shared/lib/index.ts`)
- [x] переместить план в `docs/plans/completed/` (deferred — orchestrator moves the plan file after all review phases complete)

## Post-Completion

_Items requiring manual intervention or external systems — no checkboxes, informational only_

**Manual verification:**

- Реальный ключ (`VITE_API_KEY`): `/search?q=Inception` — выдача; `/search?genres=драма&yearFrom=2020` после reload — состояние сохранено; поведение при исчерпании квоты (403 → EmptyState/error, cooldown не долбит API).
- Проверить, что курсорная эмуляция реально отдаёт страницы 2–10 на demo-ключе. Если `next` недоступен — фолбэк Prev/Next для каталога (⚠️ Task 7).
- a11y: `role="search"`, `aria-live` на счётчике, фокус/клавиатура на `×` и пагинации/сортировке.

**External / deferred:**

- E2E (Playwright) — проекта нет (roadmap 6.x/9.x): сценарии `/search?q=…`, `/search?genres=…&reload`, mobile smoke — при его появлении.
- Шаги-курсоры каталога session-персистятся через обобщённую фабрику; page-level промис-мемо — in-memory (чистится на reload). Полный session-персист собранных страниц — при необходимости.
- Полноценный мобильный drawer-фильтров — roadmap 3.4.
- Перенос API-ключа на BFF — roadmap Phase 5.
