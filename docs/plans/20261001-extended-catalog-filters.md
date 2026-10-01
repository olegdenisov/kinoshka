# Расширенные фильтры каталога

## Overview

- Каталог `/search` получает четыре новых фильтра: **страна**, **длительность**, **онлайн-кинотеатр**, **подборка**. Сейчас есть только тип, жанры, годы и минимальный рейтинг.
- Групп фильтров становится восемь, поэтому группы превращаются в аккордеон (нативный `<details>`), а содержимое сайдбара и мобильной шторки, которое сейчас свёрстано дважды, сводится в общий `FilterPanel`.
- Интеграция — по существующему пути: `FilterState` → URL (единственный источник истины) → `filtersToParams` → курсорный эндпоинт `getV15Movie`. Новых эндпоинтов каталога нет; словарь стран берётся из того же `/v1.5/dictionary/{type}`, что и жанры.

## Context (from discovery)

- Модель и URL: `src/features/catalog-filter/model/useFilterState.ts`, `lib/searchParams.ts`, `lib/filtersToParams.ts`, barrel `index.ts`.
- UI фильтров: `src/features/catalog-filter/ui/GenreSelector/` (шорт-лист ∪ выбранные, «Показать все», синтетический чип для значения не из словаря), `YearRangeSlider/`, `ActiveFilterChips/`.
- Контейнеры: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx` (локальный `FilterGroup`, `RadioRow` для Type) и мобильный `BottomSheet` в `src/pages/search/ui/Search/Search.tsx` — разметка Genre/Year/Rating продублирована в обоих.
- Словарь жанров: `src/entities/movie/api/genreDictionaryCache.ts` (localStorage-слот, TTL 7 дней, кулдаун, in-flight дедупликация), `api/getGenreDictionary.ts`, `hooks/useGenreDictionary.ts`, `model/genre.ts`.
- Тесты рядом с кодом (`*.test.ts(x)`), MSW-хендлеры и сброс состояния словаря — в `src/test/setup.ts` (`onUnhandledRequest: 'error'`). E2E — `e2e/search.spec.ts` против живого API.
- Бюджеты: `size-limit` в `package.json`. Код `features`/`entities`/`widgets` попадает в чанк `shared` (`codeSplitting` в `vite.config.ts`), в `page-search` — только `src/pages/search/`.
- `src/pages/search/model/useCatalogUpdateStatus.ts`: `areFiltersEqual` сравнивает поля `FilterState` поимённо — новое поле, не добавленное туда, меняет URL, но не перезапрашивает каталог.
- Правила области: `.claude/rules/search-catalog.md`.

**Сверено с живым API 2026-10-01** (значения ниже — фактические, не догадки):

- `GET /v1.5/dictionary/countries` → `{ items: [{ id, name, slug: null, enName: null }], total: 240 }` — та же форма, что у жанров; английских названий API не отдаёт.
- Имена платформ в `watchability.items.name` (по убыванию встречаемости в топе): `Kinopoisk HD`, `Иви`, `Okko`, `Wink`, `КИОН`, `PREMIER`, `START`, `Amediateka`.
- Существующие slug'и подборок: `top250`, `top500`, `popular-films`, `popular-series`, `series-top250`, `hd-must-see`, `100_greatest_movies_XXI`, `oscar-best-film-nominees`.

## Development Approach

- **Testing approach**: Regular (код → тесты в той же задаче), как во всех завершённых планах репозитория.
- Работа на ветке `feat/extended-catalog-filters`, слияние в `main` только через PR.
- Каждая задача завершается полностью до перехода к следующей; изменения маленькие и сфокусированные.
- **Каждая задача обязана включать новые/обновлённые тесты** для своего кода — успешные и ошибочные сценарии, отдельными пунктами чек-листа.
- **Все тесты (`make test`) и `make typecheck` зелёные до начала следующей задачи.**
- **План обновляется, если объём меняется по ходу реализации.**
- Обратная совместимость: существующие URL (`?type`, `?genres`, `?yearFrom`, `?yearTo`, `?rating`, `?sort`) работают как раньше; поведение `GenreSelector` и жанрового словаря не меняется.
- Конвенции: `type`, не `interface`; `const Foo = ({ p }: FooProps) =>`; без `useMemo`/`useCallback`/`memo` (React Compiler); цвета только через `var(--token)`; mobile-first CSS; WHY-комментарии на русском; импорт слайсов только через `index.ts`.

## Testing Strategy

- **Unit**: `searchParams` (round-trip новых полей, мусор в URL), `filtersToParams` (диапазоны `movieLength`, массивы), `useCatalogUpdateStatus` (новые поля меняют `deferredFilters`), `useFilterState` (чипы и их снятие), `createDictionaryCache`.
- **Компонентные**: `ChipSelect`, `FilterGroup`, `FilterPanel`, `CountrySelector`; существующие `GenreSelector.test.tsx`, `SearchSidebar.test.tsx`, `Search.test.tsx` остаются зелёными (правятся только там, где меняется разметка).
- **MSW**: дефолтный хендлер `*/v1.5/dictionary/countries` в `src/test/setup.ts`.
- **E2E**: шаг с фильтром длительности в существующем тесте `filter:` в `e2e/search.spec.ts` (не отдельный тест — правило «one flow per journey» и квота 200/день; +1 запрос каталога).

## Progress Tracking

- выполненные пункты сразу отмечаются `[x]`
- новые обнаруженные задачи — с префиксом ➕
- проблемы и блокеры — с префиксом ⚠️
- при отклонении от плана план правится, а не игнорируется

## Solution Overview

- **Раскладка — аккордеон.** `FilterGroup` переезжает из `SearchSidebar` в `@features/catalog-filter` и становится `<details>/<summary>`: клавиатура и состояние раскрытия достаются от браузера, React его не хранит и в URL оно не попадает. Группа открыта при монтировании, если она базовая (Genre/Year/Rating) или в ней есть активное значение; в `summary` — счётчик выбранного.
- **Один чип-селектор.** Логика `GenreSelector` выносится в generic `ChipSelect`; жанры, страны, платформы, подборки и длительность рендерятся им. Одиночный выбор (длительность, подборка) делает вызывающая сторона: `value === x ? null : x`, как сейчас у Rating.
- **Общий `FilterPanel`** рендерит Genre/Year/Rating + четыре новые группы и используется и сайдбаром, и шторкой. Type остаётся в каждом контейнере своим (radio-rows со счётчиками vs сетка кнопок — разные контролы), но оборачивается тем же `FilterGroup`, чтобы все группы выглядели и сворачивались одинаково. Сами контейнеры (`aside` vs `BottomSheet`) не сливаются — это осознанное решение плана mobile-first; третий потребитель `useViewport()` не появляется.
- **Словарь стран** — второй экземпляр обобщённого кэша словарей. Копировать `genreDictionaryCache` нельзя: кулдаун/дедупликация/защита от пустого ответа должны остаться в одном месте.
- **Платформы и подборки — хардкод**: словаря платформ в API нет, а `/list` отдаёт сотни авто-подборок (`country1`, `year2018`, `genredrama`…), бесполезных как фильтр.
- **Подборка — одиночный выбор**: несколько `lists` API объединяет по ИЛИ, что рядом с остальными И-фильтрами даёт непредсказуемую выдачу.
- **Длительность — три пресета**, а не второй dual-thumb слайдер.

## Technical Details

Новые поля `FilterState`:

| Поле        | Тип                                     | URL                        | API-параметр                                   |
| ----------- | --------------------------------------- | -------------------------- | ---------------------------------------------- |
| `countries` | `string[]`                              | `?countries=США,Франция`   | `'countries.name': string[]`                   |
| `duration`  | `'short' \| 'medium' \| 'long' \| null` | `?duration=medium`         | `movieLength: ['1-89' \| '90-120' \| '121-999']` |
| `platforms` | `string[]`                              | `?platforms=Иви,Okko`      | `'watchability.items.name': string[]`          |
| `list`      | `string \| null`                        | `?list=top250`             | `lists: [slug]`                                |

- Канонические значения стран и платформ — имена из API как есть (как у жанров). В URL списки через запятую; ни одно из сверенных имён запятую не содержит.
- Zod (`FilterStateSchema`): `duration` — `z.enum([...]).nullable()`, неизвестное значение роняет весь `FilterState` в `EMPTY_FILTERS` (текущее поведение для мусора); `countries`/`platforms` — `z.array(z.string())`, `list` — `z.string().nullable()`. Неизвестная страна/платформа/slug уходит в API и даёт пустую выдачу со снимаемым чипом — то же принятое поведение, что у legacy-жанров.
- `FILTER_URL_KEYS` += `countries`, `duration`, `platforms`, `list` → `stripFilterAndSortParams` и `usePageSync` подхватывают новые ключи без правок.

Статические опции (`src/features/catalog-filter/lib/filterOptions.ts`):

- `DURATION_OPTIONS`: `short` → «Under 90 min» / `1-89`; `medium` → «90–120 min» / `90-120`; `long` → «Over 2 hours» / `121-999`.
- `PLATFORM_OPTIONS` (value → label): `Kinopoisk HD`, `Иви` → «Ivi», `Okko`, `Wink`, `КИОН` → «Kion», `PREMIER` → «Premier», `START` → «Start», `Amediateka`.
- `LIST_OPTIONS` (slug → label): `top250` → «Top 250», `top500` → «Top 500», `series-top250` → «Top 250 series», `popular-films` → «Popular movies», `popular-series` → «Popular series», `hd-must-see` → «Must see», `100_greatest_movies_XXI` → «Best of the 21st century», `oscar-best-film-nominees` → «Oscar nominees».
- `COUNTRY_LABELS` — английские подписи для стран шорт-листа (API не отдаёт `enName`), остальные показываются по-русски. Живёт в фиче рядом с `genreMap`, а не в entity.
- `getDurationLabel` / `getPlatformLabel` / `getListLabel` / `getCountryLabel` — фолбэк на сырое значение (как `getGenreLabel`).

Страны:

- `STATIC_FALLBACK_COUNTRIES` в `entities/movie/model/country.ts` (шорт-лист и фолбэк при недоступном словаре): США, Россия, Великобритания, Франция, Германия, Италия, Япония, Южная Корея, Испания, Канада.
- `createDictionaryCache({ storageKey, fetchItems: () => Promise<string[]> })` возвращает `{ slot, isStale, refresh, invalidate, resetState }`; состояние кулдауна/in-flight — в замыкании экземпляра. Жанровый экземпляр сохраняет ключ `kinoshka:genres` и текущие экспорты; страны — `kinoshka:countries`.
- `useCountryDictionary()` — синхронный хук (без Suspense), вызывается внутри `CountrySelector`. Группа Country по умолчанию свёрнута, `CountrySelector` монтируется только в открытой группе → запрос словаря уходит при первом раскрытии, а не на каждом заходе на `/search`.

Компоненты:

- `ChipSelect`: `items: string[]`, `defaults?: string[]` (если не задан — показываются все, без кнопки «Показать все»), `selected: string[]`, `getLabel`, `onToggle`, `disabled`, `compact`, `groupLabel` (статическая строка для accessible name кнопки «Показать все»/«Свернуть»), `searchable?` (поле-фильтр по подстроке в развёрнутом состоянии; локальный `useState`, текст не попадает в URL/`aria-label`/аналитику — см. `sentry.md`).
- `FilterGroup`: `title`, `count?`, `defaultOpen`, `compact`, `children`. Раскрытие — `useState(defaultOpen)` + `onToggle`; проп читается только при монтировании. Дети закрытой группы не рендерятся до первого раскрытия.
- `FilterPanel`: `filters`, `onFiltersChange`, `onToggleGenre`, `disabled`, `compact`.
- Чипы активных фильтров (`useFilterState`): по одному на страну и платформу, один на длительность, один на подборку.

## What Goes Where

- **Implementation Steps** (`[ ]`): код, тесты, правка `search-catalog.md`, бюджет `size-limit`.
- **Post-Completion** (без чекбоксов): ручная проверка на живом API и в обеих темах, PR.

## Implementation Steps

### Task 1: Расширить FilterState, URL-сериализацию и маппинг в API

**Model:** opus — модель данных и формат URL, на которые опираются все следующие задачи

**Files:**

- Create: `src/features/catalog-filter/lib/filterOptions.ts`
- Create: `src/features/catalog-filter/lib/filterOptions.test.ts`
- Modify: `src/features/catalog-filter/model/useFilterState.ts`
- Modify: `src/features/catalog-filter/lib/searchParams.ts`
- Modify: `src/features/catalog-filter/lib/filtersToParams.ts`
- Modify: `src/pages/search/model/useCatalogUpdateStatus.ts`
- Modify: `src/features/catalog-filter/lib/searchParams.test.ts`
- Modify: `src/features/catalog-filter/lib/filtersToParams.test.ts`
- Modify: `src/pages/search/model/useCatalogUpdateStatus.test.tsx`
- Modify: `src/pages/search/model/usePageSync.test.tsx`
- Modify: `src/pages/search/model/useMovieCatalog.test.tsx`
- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.test.tsx`

- [ ] создать ветку `feat/extended-catalog-filters`
- [ ] создать `filterOptions.ts`: `DURATION_OPTIONS`, `PLATFORM_OPTIONS`, `LIST_OPTIONS`, `COUNTRY_LABELS` и `getDurationLabel`/`getPlatformLabel`/`getListLabel`/`getCountryLabel` со значениями из Technical Details
- [ ] добавить в `FilterState` поля `countries`, `duration`, `platforms`, `list`; обновить `EMPTY_FILTERS`, `FILTER_URL_KEYS`, `FilterStateSchema`
- [ ] дополнить `getFilterFromSearchParams` и `filtersToSearchParams` новыми ключами (пустые/`null` в URL не пишутся)
- [ ] дополнить `filtersToParams`: `countries.name`, `movieLength` из пресета, `watchability.items.name`, `lists`
- [ ] дополнить `areFiltersEqual` в `useCatalogUpdateStatus.ts` новыми полями — без этого смена только нового фильтра обновляет URL и чип, но не `deferredFilters`, и запрос каталога не уходит (typecheck это не ловит)
- [ ] починить литералы `FilterState` в тестах: локальные копии `EMPTY_FILTERS` (`filtersToParams.test.ts`, `usePageSync.test.tsx`, `useCatalogUpdateStatus.test.tsx`, `useMovieCatalog.test.tsx`) заменить импортом из `@features/catalog-filter`; поправить литералы в `searchParams.test.ts` и `baseFilters` в `SearchSidebar.test.tsx`
- [ ] тесты `filterOptions`: лейблы известных значений и фолбэк на сырое значение
- [ ] тесты `searchParams`: round-trip каждого нового поля и всех сразу; `?duration=foo` → `EMPTY_FILTERS`; пустые значения (`?countries=`) → пустой массив; `stripFilterAndSortParams` удаляет новые ключи и не трогает `?q`/`?page`
- [ ] тесты `filtersToParams`: каждый пресет длительности → свой диапазон; массивы стран/платформ; `list` → `lists: [slug]`; пустой фильтр по-прежнему даёт `{ limit: 12 }`
- [ ] тесты `useCatalogUpdateStatus`: смена только `duration`, только `countries`, только `platforms`, только `list` меняет `deferredFilters`
- [ ] `make typecheck` и `make test` — зелёные до задачи 2

### Task 2: Чипы активных фильтров для новых полей

**Model:** sonnet — спецификация чипов задана, тесты показывают результат

**Files:**

- Modify: `src/features/catalog-filter/model/useFilterState.ts`
- Modify: `src/features/catalog-filter/model/useFilterState.test.tsx`

- [ ] добавить в `activeChips` чипы: по одному на каждую страну и платформу (снятие убирает только её), один на длительность, один на подборку — подписи через хелперы из `filterOptions.ts`
- [ ] тесты: чипы появляются для каждого нового поля с ожидаемой подписью (страна из шорт-листа — по-английски, остальные — как есть)
- [ ] тесты: `onRemove` каждого чипа меняет только своё поле в URL и не трогает остальные параметры; `resetFilters` очищает новые ключи
- [ ] `make test` — зелёные до задачи 3

### Task 3: Обобщить кэш словарей и добавить словарь стран

**Model:** opus — общий кэш с кулдауном и in-flight состоянием, ошибка в рефакторинге не ловится собственными проверками

**Files:**

- Create: `src/entities/movie/api/createDictionaryCache.ts`
- Create: `src/entities/movie/api/createDictionaryCache.test.ts`
- Create: `src/entities/movie/api/getCountryDictionary.ts`
- Create: `src/entities/movie/api/getCountryDictionary.test.ts`
- Create: `src/entities/movie/api/countryDictionaryCache.ts`
- Create: `src/entities/movie/hooks/useCountryDictionary.ts`
- Create: `src/entities/movie/hooks/useCountryDictionary.test.tsx`
- Create: `src/entities/movie/model/country.ts`
- Modify: `src/entities/movie/api/genreDictionaryCache.ts`
- Modify: `src/entities/movie/index.ts`
- Modify: `src/test/setup.ts`

- [ ] вынести логику `genreDictionaryCache.ts` в фабрику `createDictionaryCache({ storageKey, fetchItems })`, где `fetchItems: () => Promise<string[]>`; кулдаун, in-flight дедупликация и установка `lastAttemptAt` до запроса сохраняются как есть, состояние живёт в замыкании экземпляра, слот создаётся один раз на экземпляр
- [ ] переписать `genreDictionaryCache.ts` как экземпляр фабрики с ключом `kinoshka:genres` (`fetchItems` = `getGenreDictionary` + `.map(g => g.name)`), сохранив все существующие экспорты и их сигнатуры; `genreDictionaryCache.test.ts` и тесты `useGenreDictionary` не правятся — они и есть регрессионная сетка рефакторинга
- [ ] создать `model/country.ts` с `STATIC_FALLBACK_COUNTRIES` (только имена; подписи живут в фиче, как `genreMap`)
- [ ] создать `getCountryDictionary.ts` (`getV15DictionaryByType({ path: { type: 'countries' } })`, сужение ошибки как в `getGenreDictionary`, возвращает `string[]`) и `countryDictionaryCache.ts` (экземпляр с ключом `kinoshka:countries`; отдельный `invalidate` для стран не экспортировать)
- [ ] создать `useCountryDictionary()` по образцу `useGenreDictionary` — синхронный, с фолбэком на `STATIC_FALLBACK_COUNTRIES`; реэкспортировать из него `resetCountryDictionaryState`
- [ ] экспортировать из `src/entities/movie/index.ts`: `useCountryDictionary`, `STATIC_FALLBACK_COUNTRIES`, `resetCountryDictionaryState`
- [ ] добавить в `src/test/setup.ts` дефолтный MSW-хендлер `*/v1.5/dictionary/countries` и вызов `resetCountryDictionaryState()` в глобальном `afterEach`
- [ ] тесты `createDictionaryCache`: успех пишет слот; параллельные вызовы дают один запрос; кулдаун после ошибки и после `200` с пустым `items`; два экземпляра не делят состояние
- [ ] тесты `getCountryDictionary` (успех, ответ с `statusCode` → `ApiError`) и `useCountryDictionary` (фолбэк → данные из API; устаревший кэш отдаётся сразу и обновляется в фоне)
- [ ] `make test` — зелёные (включая нетронутые жанровые тесты) до задачи 4

### Task 4: Generic ChipSelect и перевод GenreSelector на него

**Model:** sonnet — вынос существующей логики, поведение зафиксировано тестами GenreSelector

**Files:**

- Create: `src/features/catalog-filter/ui/ChipSelect/index.tsx`
- Create: `src/features/catalog-filter/ui/ChipSelect/ChipSelect.tsx`
- Create: `src/features/catalog-filter/ui/ChipSelect/ChipSelect.module.css`
- Create: `src/features/catalog-filter/ui/ChipSelect/ChipSelect.test.tsx`
- Modify: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.tsx`
- Delete: `src/features/catalog-filter/ui/GenreSelector/GenreSelector.module.css` (стили переезжают в `ChipSelect.module.css`)

- [ ] создать `ChipSelect` с пропами из Technical Details: логика «`defaults` ∪ `selected`», «Показать все (N)», синтетический чип для выбранного значения вне `items` (с дедупликацией по лейблу), `aria-pressed`, варианты `compact`
- [ ] кнопке «Показать все»/«Свернуть» дать `aria-label` из статического пропа `groupLabel` (напр. «Свернуть: Genre») — в открытой панели таких кнопок несколько, совпадающие accessible names запрещены baseline'ом
- [ ] добавить режим `searchable`: в развёрнутом состоянии над чипами — `<input type='search'>` со статическим `aria-label`, фильтрация по подстроке без учёта регистра по значению и лейблу; выбранные чипы не скрываются фильтром
- [ ] перевести `GenreSelector` на `ChipSelect` (тонкая обёртка: `useGenreDictionary`, `STATIC_FALLBACK_GENRES`, `getGenreLabel`), перенести стили чипов, цвета только через токены
- [ ] тесты `ChipSelect`: шорт-лист по умолчанию; «Показать все»/«Свернуть»; без `defaults` показаны все и кнопки нет; синтетический чип; `disabled`; `compact`-класс; accessible name кнопки содержит `groupLabel`
- [ ] тесты `ChipSelect` (`searchable`): фильтрация сужает список; выбранное остаётся видимым; пустой результат не ломает рендер
- [ ] `GenreSelector.test.tsx` проходит (ожидания правятся только там, где изменился accessible name кнопки); `make test` — зелёные до задачи 5

### Task 5: Аккордеон FilterGroup и селектор стран

**Model:** sonnet — реализация и ловушки jsdom расписаны в плане, покрывается компонентными тестами

**Files:**

- Create: `src/features/catalog-filter/ui/FilterGroup/index.tsx`
- Create: `src/features/catalog-filter/ui/FilterGroup/FilterGroup.tsx`
- Create: `src/features/catalog-filter/ui/FilterGroup/FilterGroup.module.css`
- Create: `src/features/catalog-filter/ui/FilterGroup/FilterGroup.test.tsx`
- Create: `src/features/catalog-filter/ui/CountrySelector/index.tsx`
- Create: `src/features/catalog-filter/ui/CountrySelector/CountrySelector.tsx`
- Create: `src/features/catalog-filter/ui/CountrySelector/CountrySelector.test.tsx`

- [ ] создать `FilterGroup` на `<details>/<summary>`: заголовок, счётчик `count` (скрыт при 0), маркер раскрытия — CSS, варианты `compact`; стили — по текущим `filterGroup`/`fieldLabel`, mobile-first
- [ ] раскрытие хранить в `useState(defaultOpen)` и синхронизировать через `onToggle` — `open` не привязывать к пропу после монтирования (WHY-комментарий: `FilterPanel` пересчитывает `defaultOpen` из `filters` на каждом рендере, и снятие последнего чипа иначе схлопнуло бы группу под рукой пользователя)
- [ ] дети закрытой группы не рендерятся до первого раскрытия (флаг «открывалась ли») — WHY-комментарий: словарь стран не должен тратить квоту API, пока группа закрыта
- [ ] создать `CountrySelector`: `ChipSelect` + `useCountryDictionary()`, `defaults` = `STATIC_FALLBACK_COUNTRIES`, `getLabel` = `getCountryLabel`, `searchable`
- [ ] тесты `FilterGroup`: `defaultOpen` true/false; счётчик; клик по `summary` раскрывает, дети остаются после сворачивания; смена пропа `defaultOpen` после монтирования не закрывает группу. В jsdom `toggle` приходит асинхронно — после клика ждать через `await screen.findBy…`/`waitFor` (при fake timers — продвинуть таймеры). Клавиатурный тест не писать: `user-event` не превращает Enter на `summary` в click, это нативное поведение браузера (см. Post-Completion)
- [ ] тесты `CountrySelector`: шорт-лист до загрузки словаря; полный список после «Показать все»; выбор вызывает `onToggle` с русским каноническим именем
- [ ] `make test` — зелёные до задачи 6

### Task 6: Общий FilterPanel

**Model:** sonnet — состав групп и поведение заданы планом, покрывается компонентными тестами

**Files:**

- Create: `src/features/catalog-filter/ui/FilterPanel/index.tsx`
- Create: `src/features/catalog-filter/ui/FilterPanel/FilterPanel.tsx`
- Create: `src/features/catalog-filter/ui/FilterPanel/FilterPanel.module.css`
- Create: `src/features/catalog-filter/ui/FilterPanel/FilterPanel.test.tsx`
- Modify: `src/features/catalog-filter/index.ts`

- [ ] создать `FilterPanel`: группы Genre, Year, Rating (открыты по умолчанию), затем Country, Duration, Streaming, Collection (свёрнуты, если в них нет активного значения); счётчики в заголовках; кнопки рейтинга (5+…9+) переезжают сюда, заголовок группы — «Rating» в обоих вариантах
- [ ] одиночный выбор длительности и подборки — повторный клик по активному чипу сбрасывает в `null`; `disabled` прокидывается во все контролы
- [ ] экспортировать из barrel `FilterPanel` и `FilterGroup` (контейнеры оборачивают им группу Type)
- [ ] тесты `FilterPanel`: базовые группы открыты, новые закрыты; группа с активным значением открыта и показывает счётчик; выбор в каждой новой группе вызывает `onFiltersChange` с ожидаемым `FilterState`; повторный клик сбрасывает одиночный выбор; `disabled`; раскрытие закрытых групп — с `findBy…`/`waitFor`
- [ ] тест: при закрытой группе Country запрос `*/v1.5/dictionary/countries` не уходит (MSW-хендлер со счётчиком)
- [ ] `make test` — зелёные до задачи 7

### Task 7: Подключить FilterPanel в сайдбар и мобильную шторку

**Model:** opus — меняет разметку на стыке виджета и страницы; расхождение десктоп/мобайл не ловится тестами одной стороны

**Files:**

- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.tsx`
- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.module.css`
- Modify: `src/widgets/search-sidebar/ui/SearchSidebar/SearchSidebar.test.tsx`
- Modify: `src/pages/search/ui/Search/Search.tsx`
- Modify: `src/pages/search/ui/Search/Search.module.css`
- Modify: `src/pages/search/ui/Search/Search.test.tsx`
- Modify: `src/features/catalog-filter/index.ts`
- Modify: `e2e/search.spec.ts`
- Modify: `package.json` (только если `make size` превысит бюджет)

- [ ] `SearchSidebar`: Type (`RadioRow`) обернуть в `<FilterGroup title='Type' defaultOpen>` из barrel, ниже — `<FilterPanel />`, затем Reset; удалить локальный `FilterGroup` и осиротевшие стили
- [ ] `Search.tsx`: в `BottomSheet` Type-сетку обернуть в `<FilterGroup title='Type' defaultOpen compact>`, ниже — `<FilterPanel compact />`, футер без изменений; удалить осиротевшие стили; новых вызовов `useViewport()` не добавлять
- [ ] убрать `GenreSelector`/`YearRangeSlider` из barrel `catalog-filter` — снаружи они больше не используются
- [ ] обновить `SearchSidebar.test.tsx` и `Search.test.tsx` под новую разметку
- [ ] тест в `Search.test.tsx`: клик по пресету длительности в UI приводит к новому запросу каталога с `movieLength` (проверка по MSW-хендлеру) — на десктопе и в шторке
- [ ] тест в `Search.test.tsx`: deep link `?duration=long&list=top250` показывает раскрытые группы и чипы
- [ ] e2e: дописать шаг в существующий тест `filter:` в `e2e/search.spec.ts` (не отдельный тест — квота): `getByText('Duration')` → выбрать пресет → в URL `duration=…`, виден чип, выдача отличается от предыдущей (сравнить первую карточку или дождаться ответа каталога с `movieLength`); обновить устаревший комментарий про `aria-pressed` только у чипов жанров
- [ ] `make build-only && make size` — проверить чанки `shared` (сюда попадает весь новый код фичи/entity) и `page-search`; при превышении пересчитать лимит как измеренный gzip + 15% по правилу из `build-budgets.md`
- [ ] `make test` и e2e `search.spec.ts` — зелёные до задачи 8

### Task 8: Проверка критериев приёмки

**Model:** sonnet — сверка результата с планом и устранение пробелов

- [ ] все четыре фильтра работают из URL и из UI на десктопе и в мобильной шторке: меняется и URL, и выдача; чипы снимаются по одному
- [ ] вход в текстовый поиск (`?q`) вычищает новые параметры и дизейблит панель; старые ссылки с прежними параметрами работают без изменений
- [ ] в открытой панели нет двух кнопок с одинаковым accessible name
- [ ] полный прогон: `make check`, `make test`, `make knip`, `make size`
- [ ] `make e2e` (с учётом квоты 200 запросов/день)

### Task 9: [Final] Документация

**Model:** haiku — точный текст и пути заданы планом

- [ ] в frontmatter `paths:` файла `.claude/rules/search-catalog.md` добавить: `src/entities/movie/api/createDictionaryCache.ts`, `src/entities/movie/api/countryDictionaryCache.ts`, `src/entities/movie/hooks/useCountryDictionary.ts`, `src/entities/movie/model/country.ts`
- [ ] в раздел про жанры дописать (на английском): the same rule applies to countries — canonical value is the Russian `name`, the API has no `enName`, English labels exist only for the shortlist
- [ ] добавить раздел `## Filters` (на английском, только решения): `list` is single-select because the API ORs multiple `lists`; platforms and lists are hardcoded in `filterOptions.ts` — the API has no platform dictionary and `/list` is dominated by auto-generated collections; a new `FilterState` field must also be added to `areFiltersEqual` in `useCatalogUpdateStatus.ts`, otherwise the URL changes but the catalog is not refetched
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка:**

- пройти все восемь групп в светлой и тёмной теме на десктопе и на ширине < 720px: контраст чипов, маркер аккордеона, скролл шторки с раскрытой группой Country
- проверить на живом API осмысленность выдачи для сочетаний «платформа + страна» и «подборка + жанр» (данные `watchability` заполнены неравномерно)
- проверить `type=series` + длительность: у сериалов `movieLength` обычно пуст (длительность серии — в `seriesLength`), выдача может оказаться пустой; если так — завести пункт в `docs/backlog/`
- клавиатура и скринридер: раскрытие групп, поле поиска по странам, отсутствие дублирующихся accessible names в открытой шторке

**Внешнее:**

- открыть PR в `main` (описание на русском)
- имена платформ и slug'и подборок — данные стороннего API; при смене на его стороне фильтр молча даёт пустую выдачу, правится в `filterOptions.ts`
