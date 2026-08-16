# Favorites (roadmap 2.1)

## Overview

Реализовать фичу «Избранное» (`plans/roadmap.md`, пункт **2.1 Favorites ⭐**, Фаза 2): пользователь может добавлять/убирать фильмы в избранное кнопкой-сердечком на карточке в любом месте приложения, видеть список избранного на странице `/favorites`, данные хранятся только в `localStorage` (без бэкенда — миграция на сервер и `useOptimistic` отложены до Фазы 5, см. roadmap 5.4).

Ключевые решения, принятые в ходе планирования:

- Кнопка-сердечко реализуется **и в `Card` (desktop), и в `MobileCard` (mobile)** — у `MobileCard` сейчас вообще нет action-кнопок, паритет UX важнее буквального прочтения roadmap-пункта (там упомянут только `Card`).
- Пункт **2.8 «Навигация»** для `/favorites` выполняется сразу в этом плане (ссылка в `Header`, разблокировка `BottomNav.lists`), а не отдельным проходом позже — по собственной рекомендации roadmap («делай это сразу по мере появления каждой страницы»).
- Тестирование — Regular (код → тесты), без TDD.

## Context (from discovery)

- **`createStorageSlot`/`useStorageSlot`** (`src/shared/lib/storage/`) — уже даёт всё нужное: zod-валидация при чтении, `useSyncExternalStore`-совместимая реактивность, синк между вкладками через `storage`-event + внутримодульный `EventTarget` для same-tab. Пример потребителя — `src/entities/movie/api/genreDictionaryCache.ts` (`createStorageSlot(key, schema, fallback)`).
- **`entities/movie/api/getMovieDetail.ts`** уже реализует ровно нужный примитив «получить `MovieDetail` по `id` с кэшем и cooldown на ошибках» через `createCachedFetcher<number, MovieDetail>('movie-detail', fetchMovieDetail)`. `MovieDetail extends Movie`, значит его результат можно напрямую использовать там, где нужен `Movie` (для карточек). Батч-загрузку избранного проще всего построить поверх этого фетчера через `Promise.allSettled`, а не заводить отдельный урезанный «getMovieById».
- **`createCachedFetcher<P, R>`** (`src/entities/movie/api/createCachedFetcher.ts`) — обобщённый кэш (in-memory + sessionStorage + error-cooldown), уже используется с произвольным `R` (`getSearchMovies`/`getMoviesPage` возвращают `{movies, totalPages}`). Кэш-ключ — `JSON.stringify(params)`, поэтому фетчер с `P = number[]` естественно переинвалидируется при каждом изменении набора избранных id.
- **`Card`** (`src/entities/movie/ui/Card/Card.tsx`) и **`CardBtn`** (`.../Card/CardBtn/CardBtn.tsx`) — `CardBtn` сейчас без `onClick`-пропа (только внутренний `stopPropagation`), три плейсхолдер-кнопки (`Rate`/`Add`/`Eye`) без логики. `Card` завёрнут в `<Link to="/movie/:id">`.
- **`MobileCard`** (`src/entities/movie/ui/MobileCard/MobileCard.tsx`) — вообще без кнопок-действий, только постер/рейтинг/тайтл/мета.
- **`HeartIcon`** уже существует в `src/shared/ui/Icon/Icon.tsx` и уже поддерживает `filled?: boolean` — специально спроектирован под ровно этот сценарий, просто не был подключён.
- **Реальные места рендера карточек** (все — потенциальные точки входа для добавления в избранное):
  - `Card`: `src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.tsx`, `src/pages/movie/ui/RelatedMovies/RelatedMovies.tsx`, `src/pages/search/ui/SearchResultsGrid/SearchResultsGrid.tsx`.
  - `MobileCard`: `src/widgets/movie-rail/ui/MovieRailMobile/MovieRailMobile.tsx`, `src/pages/movie/ui/MovieMobile.tsx` (related-секция), `src/pages/search/ui/SearchMobile.tsx`.
- **`AsyncBoundary`** (`@shared/ui`) — `{ children, fallback?, errorFallback?: (params:{error,reset}) => ReactNode, onRetry? }`, паттерн подключения и `onRetry` → `invalidate(...)` уже отработан в `MoviePage.tsx`/`invalidateMovieDetail`.
- **Паттерн страницы** (эталон — `src/pages/search/`): `index.tsx` (реэкспорт), `<Page>Page.tsx` (диспетчер `useViewport().isMobile` → `*Desktop`/`*Mobile`), `ui/` для суб-компонентов. Роуты заведены напрямую в `src/app/router.tsx` (без `React.lazy`, в проекте лениая загрузка не используется).
- **Header nav** (`src/widgets/header/ui/Header/Header.tsx`) — `navItems: {key,label,path}[]`, рендер через `NavPill`. Пункта под избранное нет.
- **`BottomNav`** (`src/widgets/mobile-chrome/ui/BottomNav/BottomNav.tsx`) — `items: {key,label,icon,path: string|null}[]`, пункт `lists` уже присутствует со своей иконкой (`ListsIcon`), но `path: null` → задизейблен. Это готовый слот под мобильную ссылку на избранное.
- **`EmptyState`** (`@shared/ui`) — минимальный `{ title, description }`, без слотов под кнопку.
- Ни `src/features/favorites/`, ни `src/pages/favorites/` пока не существуют — работа не начата.
- **Ограничение demo-тарифа** (см. roadmap 1.1/1.2): 200 запросов/сутки, batch-эндпоинта по списку id нет — загрузка N избранных фильмов = N отдельных запросов `getMovieDetail`. Кэш `getMovieDetail` (5 мин TTL + sessionStorage) частично гасит нагрузку, если фильм уже открывался на `/movie/:id`, но полностью проблему не снимает — см. Post-Completion.

## Development Approach

- **Testing approach**: Regular — сначала реализация, тесты в конце каждой задачи.
- Каждая задача выполняется полностью, тесты — обязательная часть чек-листа задачи, не опциональная.
- **Все тесты должны проходить перед переходом к следующей задаче.**
- React Compiler включён — не добавлять `useMemo`/`useCallback`/`memo` вручную.
- Соблюдать направление импортов FSD: `pages → widgets → features → entities → shared`. `entities/movie/ui/Card`/`MobileCard` **не могут** импортировать `@features/favorites` — избранное туда прокидывается через пропы (`isFavorite`, `onToggleFavorite`), а вызывающие компоненты уровня `widgets`/`pages` сами дергают `useFavorites()` из `@features/favorites` и передают колбэки вниз.
- Обновлять этот файл при отклонении от плана (➕ для новых пунктов, ⚠️ для блокеров).

## Testing Strategy

- **Unit-тесты**: обязательны для каждой задачи (storage-слот, `getMoviesByIds`, `useFavorites`, `useFavoriteMovies`, пропы `Card`/`MobileCard`, страница `/favorites`).
- **Стиль**: Vitest + Testing Library, как в остальном проекте; MSW (`msw/node`) для мока `apiClient.getV15MovieById` в тестах `getMoviesByIds`; localStorage/`StorageEvent` тестируются напрямую (по образцу `src/shared/lib/storage/storage.test.ts`), без моков.
- E2E (Playwright) в проекте пока не заведён (см. roadmap 2.5.5, отдельная будущая фаза) — не в скоупе этого плана.

## Progress Tracking

- Отмечать выполненные пункты `[x]` сразу по завершении.
- Новые обнаруженные задачи — с префиксом ➕, блокеры — с префиксом ⚠️.

## What Goes Where

- **Implementation Steps** (`[ ]`): весь код, тесты, документация — выполнимо агентом в этом репозитории.
- **Post-Completion**: ручная проверка UX/квоты — не автоматизируется.

## Implementation Steps

### Task 1: Хранилище избранного (`features/favorites`)

- [x] `src/features/favorites/model/favoritesStorage.ts` — zod-схема `z.array(z.number())`, `favoritesSlot = createStorageSlot('kinoshka:favorites', favoritesSchema, [])` (по образцу `genreDictionaryCache.ts`).
- [x] `src/features/favorites/model/useFavorites.ts` — хук на `useStorageSlot(favoritesSlot)`, возвращает `{ ids: number[]; isFavorite: (id: number) => boolean; toggle: (id: number) => void; add: (id: number) => void; remove: (id: number) => void; clear: () => void }`. `add`/`toggle` дедуплицируют id (не допускать повторов в массиве).
- [x] `src/features/favorites/index.ts` — публичный API слайса: экспорт `useFavorites` (+ тип возвращаемого значения).
- [x] написать тесты для `useFavorites` (успешные сценарии): `add`/`remove`/`toggle` меняют `ids` и `isFavorite`, повторный `add`/`toggle` того же id не создаёт дубликат, `clear` опустошает список.
- [x] написать тесты для edge cases: невалидный JSON / несовпадение zod-схемы в `localStorage` → `ids` начинается с `[]` (fallback, не падает); cross-tab sync — `window.dispatchEvent(new StorageEvent('storage', { key: 'kinoshka:favorites', newValue: ... }))` отражается в хуке (по образцу тестов `storage.test.ts`).
- [x] прогнать тесты — все проходят перед Task 2.

### Task 2: Батч-загрузка избранных фильмов

- [x] `src/entities/movie/api/getMoviesByIds.ts` — `fetchMoviesByIds(ids: number[]): Promise<Movie[]>` через `Promise.allSettled(ids.map(id => getMovieDetail(id)))`, фильтрует только `status === 'fulfilled'`, маппит в `Movie[]` (порядок — как во входном `ids`, отброшенные rejected-записи просто выпадают). Обернуть в `createCachedFetcher<number[], Movie[]>('favorite-movies', fetchMoviesByIds)`.
- [x] экспортировать `getMoviesByIds` из `src/entities/movie/index.ts`.
- [x] `src/features/favorites/model/useFavoriteMovies.ts` — `use(getMoviesByIds(ids))` (React 19 Suspense-хук, читает `ids` из `useFavorites()`), рассчитан на использование внутри `<AsyncBoundary>`.
- [x] дополнить `src/features/favorites/index.ts` экспортом `useFavoriteMovies`.
- [x] написать тесты для `getMoviesByIds` (успешные сценарии): MSW-мок `getV15MovieById` на несколько id → результат `Movie[]` в правильном порядке; пустой `ids` → `[]` без сетевого запроса (assert через MSW `onUnhandledRequest:'error'`, что хендлер не дёрнулся).
- [x] написать тесты для edge cases: один из id отвечает 404/ошибкой (`ApiError`) → он молча выпадает из результата, остальные id по-прежнему присутствуют (частичный отказ через `allSettled`); повторный вызов с тем же массивом id переиспользует закэшированный промис (по аналогии с `createCachedFetcher.test.ts`).
- [x] прогнать тесты — все проходят перед Task 3.

### Task 3: Кнопка-сердечко в `Card` и `MobileCard`

- [x] `src/entities/movie/ui/Card/CardBtn/CardBtn.tsx` — добавить пропы `onClick?: (e: React.MouseEvent) => void`, `active?: boolean`; внутренний обработчик — `e => { e.stopPropagation(); onClick?.(e) }`; при `active` — модификатор класса (акцентный цвет из `--accent-warm`/`--accent-rating`, без хардкода hex).
- [x] `src/entities/movie/ui/Card/Card.tsx` — расширить `CardProps`: `isFavorite?: boolean; onToggleFavorite?: (id: number) => void`. Рендерить дополнительную `<CardBtn icon={<HeartIcon size={10} filled={isFavorite} />} active={isFavorite} onClick={() => onToggleFavorite?.(movie.id)} />` **только если** `onToggleFavorite` передан (иначе `Card` ведёт себя как раньше — без сердечка, обратная совместимость для мест, ещё не подключённых в Task 4).
- [x] `src/entities/movie/ui/MobileCard/MobileCard.tsx` — аналогично: `MobileCardProps` + `isFavorite?`/`onToggleFavorite?`, небольшая кнопка-оверлей поверх постера (top-right), с тем же guard `stopPropagation`/`preventDefault`, рендерится только если `onToggleFavorite` передан.
- [x] обновить `Card.module.css`/`CardBtn.module.css`/`MobileCard.module.css` под новое состояние (active/filled heart, позиционирование оверлея на мобильной карточке).
- [x] написать тесты для `Card`/`MobileCard` (успешные сценарии): без `onToggleFavorite` сердечко не рендерится (снапшот поведения не меняется); с `onToggleFavorite` — клик вызывает колбэк с `movie.id`, `isFavorite` меняет иконку на `filled`.
- [x] написать тесты для edge cases: клик по сердечку **не** триггерит переход по `Link` (навигация не происходит — проверить через `MemoryRouter`, что location не изменился после клика).
- [x] прогнать тесты — все проходят перед Task 4.

### Task 4: Подключить сердечко во всех местах рендера карточек

- [ ] `src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.tsx` — `const { isFavorite, toggle } = useFavorites()` (`@features/favorites`), прокинуть в каждый `<Card>`.
- [ ] `src/widgets/movie-rail/ui/MovieRailMobile/MovieRailMobile.tsx` — то же для `<MobileCard>`.
- [ ] `src/pages/movie/ui/RelatedMovies/RelatedMovies.tsx` — то же для `<Card>`.
- [ ] `src/pages/movie/ui/MovieMobile.tsx` (related-секция, `<MobileCard>`) — то же.
- [ ] `src/pages/search/ui/SearchResultsGrid/SearchResultsGrid.tsx` — то же для `<Card>`.
- [ ] `src/pages/search/ui/SearchMobile.tsx` (грид результатов, `<MobileCard>`) — то же.
- [ ] написать тесты (успешные сценарии): в каждом из затронутых компонентов клик по сердечку карточки действительно пишет id в `localStorage['kinoshka:favorites']` (достаточно 1-2 репрезентативных компонента с явной проверкой storage, остальные — проверка, что пропы `isFavorite`/`onToggleFavorite` прокинуты в `Card`/`MobileCard`).
- [ ] написать тесты для edge cases: повторный клик по уже избранной карточке снимает избранное (toggle туда-обратно).
- [ ] прогнать тесты — все проходят перед Task 5.

### Task 5: Страница `/favorites`

- [ ] `src/pages/favorites/index.tsx` — `export { FavoritesPage } from './FavoritesPage'`.
- [ ] `src/pages/favorites/FavoritesPage.tsx` — диспетчер `useViewport().isMobile` → `FavoritesDesktop`/`FavoritesMobile` (по образцу `SearchPage.tsx`/`MoviePage.tsx`).
- [ ] `src/pages/favorites/ui/FavoritesDesktop.tsx` и `.../FavoritesMobile.tsx` (или `.tsx`-файлы на корне страницы, как договорено паттерном `pages/search`) — если `ids.length === 0` (из `useFavorites()`) сразу рендерить `EmptyState` (без входа в Suspense/сеть); иначе — `<AsyncBoundary fallback={<Skeleton/>} onRetry={() => getMoviesByIds.invalidate(ids)} errorFallback={...}>` вокруг грида, использующего `useFavoriteMovies()` и рендерящего `Card`/`MobileCard` с `isFavorite`/`onToggleFavorite` (по образцу `SearchResultsGrid`/`SearchMobile`).
- [ ] добавить роут `{ path: '/favorites', element: <FavoritesPage /> }` в `src/app/router.tsx`.
- [ ] написать тесты (успешные сценарии): пустой список избранного → рендерится `EmptyState`; непустой список (MSW-мок нескольких id) → рендерятся карточки с данными.
- [ ] написать тесты для edge cases: один из избранных id отвечает 404 — карточка для него не рендерится, остальные рендерятся (частичный успех); клик Retry в `errorFallback` реально переинвалидирует кэш и повторяет запрос (по образцу `MoviePage.test.tsx`).
- [ ] прогнать тесты — все проходят перед Task 6.

### Task 6: Навигация к `/favorites` (roadmap 2.8, выполняется сразу)

- [ ] `src/widgets/header/ui/Header/Header.tsx` — добавить пункт `{ key: 'favorites', label: 'Favorites', path: '/favorites' }` в `navItems`.
- [ ] `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.tsx` — у пункта `lists` заменить `path: null` на `path: '/favorites'`, убрать/адаптировать ветку `navItemDisabled`/click-guard именно для этого пункта (иконка `ListsIcon` уже подходит, label можно оставить как есть или переименовать в «Favorites» — на усмотрение при реализации, если ломает вёрстку/переводы).
- [ ] написать тесты (успешные сценарии): клик по новому пункту в `Header`/`BottomNav` ведёт на `/favorites`, пункт подсвечивается как активный на этом роуте.
- [ ] написать тесты для edge cases: `BottomNav` — остальные пункты с `path: null` (если такие ещё остались) по-прежнему задизейблены, регрессии нет.
- [ ] прогнать тесты — все проходят перед Task 7.

### Task 7: Верификация критериев приёмки и документация

- [ ] сверить каждый чекбокс roadmap 2.1 (`plans/roadmap.md`) с реализацией: `features/favorites/` с моделью `{ids}` — есть; хранение через `createStorageSlot` с zod — есть; `useFavorites()` + `toggle/add/remove/clear` — есть; `isFavorite(id)` — есть; `useFavoriteMovies()` через `Promise.allSettled` — есть; кнопка-сердечко в `Card` (и `MobileCard`) — есть; `/favorites` с пустым state — есть; edge case «удалённый контент (404)» — есть; edge case cross-tab sync — есть; edge case zod-fallback — есть.
- [ ] прогнать полный набор тестов (`make test`).
- [ ] прогнать линтер (`make lint`), исправить все замечания.
- [ ] прогнать типы (`make typecheck`) и/или полную сборку (`make build`).
- [ ] обновить `AGENTS.md`: добавить строку `@features/favorites` в таблицу «Key public APIs» (`useFavorites()`, `useFavoriteMovies()`), добавить `getMoviesByIds()` в строку `@entities/movie`, короткий абзац в разделе «Data state», что Favorites — client-only фича на `localStorage` (без API-эндпоинта), по аналогии с описанием genre dictionary.
- [ ] в `plans/roadmap.md` отметить выполненные пункты 2.1 (и 2.8, если roadmap считает их отдельно) как `[x]`.

## Technical Details

- **Ключ хранилища**: `kinoshka:favorites`, схема `z.array(z.number())`, fallback `[]`. Тот же паттерн, что `kinoshka:genres` (`genreDictionaryCache.ts`), включая референциальную стабильность `get()` (уже решено в `storage.ts`, ничего чинить не нужно).
- **`getMoviesByIds(ids: number[]): Promise<Movie[]>`** — не отдельный API-эндпоинт (демо-API не поддерживает batch-by-id), а композиция уже существующего `getMovieDetail(id)` через `Promise.allSettled`, обёрнутая в `createCachedFetcher` с ключом кэша = сам массив id (`JSON.stringify`). Естественно инвалидируется на каждое изменение набора избранного, ручной `invalidate()` нужен только для Retry в `AsyncBoundary`.
- **Контракт пропов `Card`/`MobileCard`**: `isFavorite?: boolean`, `onToggleFavorite?: (id: number) => void`. Оба опциональны и независимы — компонент не тянет `@features/favorites` внутрь `entities/movie` (нарушение направления импортов FSD), вызывающая сторона (widgets/pages) сама вызывает `useFavorites()` и прокидывает колбэки.
- **Маршрут**: `/favorites`, без параметров, без query-синка (в отличие от `/search`, здесь список полностью производный от `localStorage`).

## Post-Completion

**Ручная проверка:**
- Проверить UX на десктопе и мобильном viewport (`useViewport` breakpoint 720px) — сердечко видно и кликабельно в обоих layout.
- Проверить поведение при большом числе избранного (10+) на реальном demo-ключе — каждый фильм тянет отдельный `getMovieDetail`-запрos, квота 200/сутки может закончиться быстрее, чем при обычном browsing; при необходимости в будущем можно добавить лимит/пагинацию на странице `/favorites` (вне скоупа этого плана).
- Проверить клавиатурную доступность новой кнопки (Tab/Enter) и `aria`-атрибуты сердечка (`aria-pressed`/`aria-label`), т.к. это интерактив без явной семантики — см. a11y-baseline из Фазы 0.
