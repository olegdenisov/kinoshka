# /search: индикатор загрузки при пагинации/поиске/фильтрации + сброс фильтров при поиске из шапки

## Overview

Два независимых бага на странице `/search`:

1. **Нет индикатора запроса.** При пагинации, поиске и смене фильтров UI молча "подвисает" — старый список остаётся на экране без какого-либо визуального сигнала, что идёт запрос, пока не придут новые данные.
2. **Фильтры не сбрасываются при поиске из шапки.** Если на `/search` были выбраны фильтры/сортировка, а затем пользователь вводит текст в поиск в `Header`, chips и сайдбар продолжают показывать старые фильтры как активные — хотя по API-контракту текстовый поиск не может сочетаться с фильтрами (см. AGENTS.md, "Variant A").

## Context (from discovery)

**Баг 1.** Приложение — `createBrowserRouter`/`RouterProvider` (data router), но роуты без `loader` (весь фетчинг — через `use()` внутри `useMovieCatalog`, `src/pages/search/model/useMovieCatalog.ts`). Поэтому `useNavigation()` не работает: в исходниках `react-router` (`node_modules/react-router/dist/development/chunk-D6LUOGOQ.js`) при отсутствии `loader`-ов `handleLoaders` идёт по short-circuit ветке и `navigation.state` никогда не переходит в `"loading"` — проверено чтением кода библиотеки. Настоящая причина — семантика `Suspense`: `setSearchParams` из data-router оборачивает апдейт в `startTransition`, а повторное "саспенднивание" `use()` внутри уже идущей транзакции (не при первом монтировании) не показывает `Suspense`-fallback, а молча держит старый контент. Skeleton-компоненты (`SearchResultSkeletonGrid`, `MobileResultsSkeleton`) уже подключены как `Suspense`-fallback, но фактически "мёртвый код" для повторных загрузок — работают только на первом заходе на `/search`.

**Баг 2.** `src/widgets/header/ui/Header/Header.tsx` при записи `?q` в URL (debounce-эффект) правит только этот один ключ через `setSearchParams`, остальные параметры (`type`, `genres`, `yearFrom`, `yearTo`, `rating`, `sort`) остаются нетронутыми. `useFilterState()` (`src/features/catalog-filter/model/useFilterState.ts`) полностью derived из URL — своего state нет (см. докблок в файле), поэтому `activeChips` и значения в сайдбаре продолжают отражать эти "мёртвые" параметры. `isSearchMode` в `SearchDesktop`/`SearchMobile` используется только как визуальный `disabled` (opacity/pointer-events через `.sidebarDisabled` в `SearchSidebar.module.css`), а не как триггер реальной очистки URL.

**Ключевые существующие файлы:**
- `src/pages/search/model/usePageSync.ts` — уже держит эффект, сбрасывающий `?page=1` на смену `query`/`filters` (строки 48-65), через `ref`-сравнение `resetKey`.
- `src/features/catalog-filter/lib/searchParams.ts` — уже хранит `EMPTY_FILTERS`/`getFilterFromSearchParams`/`filtersToSearchParams`.
- `src/features/catalog-filter/model/useFilterState.ts` — локальный `FILTER_KEYS` (строка 17), используется в `applyFilters`.
- `src/entities/movie/api/createCachedFetcher.ts` — кэш ключуется по `JSON.stringify(params)` (по значению, не по ссылке) — важно для решения бага 1.
- `src/shared/ui/Spinner/Spinner.tsx` — без пропсов, хардкод 48px в CSS.

### Обнаруженный нюанс (учтён в задачах)
`setSearchParams`'s functional updater замыкается на render-снэпшот `searchParams`. Если решать баг 2 отдельным эффектом (например в `SearchDesktop`, реагирующим на `isSearchMode`) — параллельно с уже существующим reset-эффектом в `usePageSync`, оба реагируют на один и тот же URL-переход и оба вызовут `setSearchParams` — при этом второй вызов молча перезатрёт эффект первого (гонка, не гипотетическая). Поэтому обе правки (сброс `page` + зачистка фильтров/sort) должны идти **одним атомарным вызовом `setSearchParams`** внутри уже существующего эффекта `usePageSync`, а не отдельным эффектом.

`useTransition`/`useNavigation` для бага 1 не годятся (см. Context выше) — решение через `useDeferredValue` + Suspense "stale content" паттерн (документированный React 19 подход), без изменений в роутинге.

## Development Approach
- Одна задача = один логический юнит; закончить полностью перед следующей.
- Каждая задача включает новые/обновлённые тесты (success + edge), отдельными пунктами чеклиста.
- Все тесты зелёные перед следующей задачей (`make test`).
- React Compiler включён — **не** добавлять `useMemo`/`useCallback`/`memo`.
- Типы через `type`, не `interface`. FSD: импорты только вниз (`pages → widgets → features → entities → shared`).
- `Header.tsx` не трогаем — он общий для `/`, `/search`, `/movie/:id` и не должен знать про URL-схему фильтров; фикс бага 2 живёт целиком в page-слое `/search`.

## Testing Strategy
- **unit:** `stripFilterAndSortParams` — прямой тест на удаление ключей; `usePageSync` — расширить существующий файл тестов (паттерн с `setSearchParamsCalls` spy уже есть).
- **компоненты/интеграция:** `SearchDesktop.test.tsx`/`SearchMobile.test.tsx` — расширить существующий тест про `?q` сбрасывает `?page`, добавить проверку на зачистку фильтров/sort; новый тест на индикатор загрузки через MSW-delay.
- **CRITICAL:** все тесты зелёные перед следующей задачей.

## Progress Tracking
`[x]` сразу по факту; ➕ новые задачи; ⚠️ блокеры; план держать в синхроне.

## Solution Overview

```
Баг 2:
Header (?q запись) ──▶ URL (?q меняется, ?genres/?sort остаются) ──▶ usePageSync reset-эффект
                                                                        │ (сначала: только ?page=1)
                                                                        ▼ (после фикса)
                                                    один атомарный setSearchParams:
                                                    stripFilterAndSortParams(prev) + ?page=1
                                                    (только при '' → non-empty query переходе)

Баг 2:
useMovieCatalog({ query, filters, sort, page })
        │
        ▼ useDeferredValue на каждом параметре (useCatalogUpdateStatus)
SearchResults(deferredQuery, deferredFilters, deferredSort, deferredPage)
        │ (кэш createCachedFetcher ключуется по значению → cache-hit, не новый запрос)
        ▼
рендерит старые/кэшированные данные, пока live !== deferred → isUpdating=true → лёгкий индикатор
```

## Tasks

### Task 1 — `stripFilterAndSortParams` helper
- [x] В `src/features/catalog-filter/lib/searchParams.ts` добавить:
  ```ts
  export const FILTER_URL_KEYS = ['type', 'genres', 'yearFrom', 'yearTo', 'rating'] as const
  export const FILTER_AND_SORT_URL_KEYS = [...FILTER_URL_KEYS, 'sort'] as const
  export const stripFilterAndSortParams = (params: URLSearchParams): URLSearchParams => { ... }
  ```
- [x] В `src/features/catalog-filter/model/useFilterState.ts` заменить локальный `FILTER_KEYS` (строка 17) на импорт `FILTER_URL_KEYS` из `../lib/searchParams` — без изменения поведения `applyFilters`/`resetFilters`.
- [x] Экспортировать `stripFilterAndSortParams` из `src/features/catalog-filter/index.ts`.
- [x] Тест `searchParams.test.ts`: `stripFilterAndSortParams` удаляет все 6 ключей, не трогает `q`/`page`, no-op на пустых params.

### Task 2 — Атомарный сброс фильтров/sort в `usePageSync`
- [x] В `src/pages/search/model/usePageSync.ts` добавить `wasSearchingRef` и расширить существующий reset-эффект: при переходе `'' → непустой query` зачищать фильтры/sort через `stripFilterAndSortParams` в том же вызове `setSearchParams`, которым сбрасывается `?page`.
- [x] Обновить докблок хука — зафиксировать, почему это один эффект, а не два (race через render-снэпшот `searchParams`, см. Context).
- [x] Тесты в `usePageSync.test.tsx` (расширить существующий файл, переиспользовать `setSearchParamsCalls` spy):
  - [x] `'' → 'inception'` с `?genres=Drama&sort=Newest&page=3` в URL → ровно один вызов `setSearchParams`, итоговые params без `genres`/`sort`, `page=1`.
  - [x] `'inception' → 'inception2'` (непустой → непустой) при уже пустых фильтрах — повторной зачистки не происходит.
  - [x] Смена `filters` при пустом `query` — поведение не меняется (page сбрасывается, зачистки нет).

### Task 3 — Регрессионные тесты бага 2 на уровне страницы
- [x] `SearchDesktop.test.tsx`: расширить существующий тест "?q сбрасывает ?page" — assert, что `lastSearch` не содержит `genres=`/`sort=`, `ActiveFilterChips`/`SortSelect` рендерятся пустыми/дефолтными после ввода в `Header`.
- [x] `SearchMobile.test.tsx`: аналогичный тест для мобильной шапки чипов и Sort-кнопки.

### Task 4 — `Spinner` с настраиваемым размером
- [ ] `src/shared/ui/Spinner/Spinner.tsx`: добавить опциональный `size?: number`, прокинуть как CSS custom property `--spinner-size`.
- [ ] `Spinner.module.css`: заменить хардкод `48px` на `var(--spinner-size, 48px)` в `.spinner`, `.spinner::before/::after`.
- [ ] Тест `Spinner.test.tsx`: `size={14}` → `--spinner-size` custom property; дефолт (без пропа) не ломает существующее использование в `AsyncBoundary`.

### Task 5 — `useCatalogUpdateStatus` хук
- [ ] Новый файл `src/pages/search/model/useCatalogUpdateStatus.ts` (page-internal facade, паттерн как у `usePageSync`/`useMovieCatalog`): `useDeferredValue` на `query`/`filters`/`sort`/`page`, сравнение `liveKey`/`deferredKey` (через `JSON.stringify`, аналогично `resetKey` в `usePageSync`) → `isUpdating: boolean`.

### Task 6 — Индикатор загрузки в `SearchDesktop`
- [ ] Вызвать `useCatalogUpdateStatus`, передать `deferred*` значения в `<SearchResults>` вместо live (live-значения оставить для `Pagination`/`SearchHeader`/`ActiveFilterChips`, чтобы клик/ввод отражались мгновенно).
- [ ] Обернуть блок результатов в `<div className={... isUpdating ? s.updating : ''} aria-busy={isUpdating}>` с бейджем `<Spinner size={14} /> Updating…` при `isUpdating`.
- [ ] `SearchDesktop.module.css`: `.resultsWrapper { position: relative }`, `.updating { opacity: 0.5; pointer-events: none; transition: opacity 150ms ease }`, `.updatingBadge` (моно-uppercase, в стиле существующего `.countText`).

### Task 7 — Индикатор загрузки в `SearchMobile`
- [ ] Та же логика через `useCatalogUpdateStatus`; т.к. файл без CSS-модуля (inline styles — существующая конвенция файла), обернуть текущий `<AsyncBoundary>` в `position: relative`-div, toggle `opacity` инлайново, инлайновый бейдж с `<Spinner size={12} />` в цветах существующих микро-лейблов файла (`#92887F`).

### Task 8 — Интеграционные тесты индикатора загрузки
- [ ] `SearchDesktop.test.tsx` / `SearchMobile.test.tsx`: через MSW задержать ответ (delay/контролируемый промис), кликнуть по пагинации или сменить фильтр, assert — прошлые данные всё ещё в DOM (не skeleton), `aria-busy="true"`/спиннер видны; после резолва — новые данные, индикатор пропадает.

## Verification (ручная, после всех задач)
- [ ] `make typecheck && make lint && make test` — всё зелёное.
- [ ] `make dev`, вручную на `/search`:
  - [ ] Ввести текст в поиск при активных фильтрах → фильтры/chips реально очищаются (не просто задизейблены).
  - [ ] Быстро кликнуть по нескольким страницам пагинации / переключить фильтр на каталоге (пустой `q`) → появляется лёгкий индикатор поверх текущего списка, список некликабелен до его исчезновения.
  - [ ] Проверить Desktop и Mobile варианты отдельно.
