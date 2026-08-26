# Recommendations 🎯 (rule-based) — roadmap 2.4

## Overview

Реализация пункта `2.4 Recommendations 🎯 (rule-based)` из `plans/roadmap.md`: страница `/recommendations`, показывающая подборку фильмов, вычисленную чистым правилом поверх избранного (`@features/favorites`) — топ-3 жанра избранных фильмов + средний рейтинг избранного минус буфер, отсортировано по рейтингу, исключая уже избранные id. Никакого ML/бэкенда — вся логика в одной pure-функции, тестируемой изолированно.

Интегрируется с существующим каталожным эндпоинтом (`getMoviesPage`, тот же, что `/search` без query) — переиспользует его кэш/403-cooldown/session-persist бесплатно, без нового API-обёрточного слоя.

## Context (from discovery)

- **Прецеденты страниц** — `/popular` (`src/pages/popular/`) и `/favorites` (`src/pages/favorites/`) задают паттерн: `Page.tsx` (viewport-переключатель `Desktop`/`Mobile`) → `ui/*Desktop`/`ui/*Mobile` (каждый: gate по синхронному условию → `EmptyState` без сети, иначе `AsyncBoundary` → grid `Card`/`MobileCard`).
- **FSD-ограничение, подтверждённое в AGENTS.md**: ни один `@features/*` сейчас не импортирует другой `@features/*` (проверено `grep`). Композиция `@features/favorites` (данные избранного) + движок правила должна жить в `src/pages/recommendations/model/` — тот же паттерн, что `useMovieCatalog` в `pages/search/model/` (page-slice facade, см. AGENTS.md).
- **`computeRecommendationQuery`** — чистая функция, живёт в `@features/recommendations/lib/`, т.к. импортирует только `Movie`/`CatalogParams` из `@entities/movie` (легальный импорт вниз для features-слоя).
- **Exclude favoriteIds** — `types.gen.ts` подтверждает синтаксис исключения по id: `id?: Array<string> | null` с примером `"666", "555", "!666"`.
- **`getMoviesPage(params, page)`** (`@entities/movie`) — уже даёт кэш промисов, 403-cooldown (`ERROR_CACHE_TTL_MS=20с`), `invalidateMoviesPage`. Рекомендациям нужна только одна страница (`page=1`), без пагинации — как `/popular`.
- **Retry-паттерн, задокументированный в AGENTS.md**: каждый retry-способный `AsyncBoundary` вызывает companion-инвалидатор рядом со своим data-хуком (`invalidateMovieCatalog`, `invalidateMovieDetail`, `invalidatePopularMovies`) — «иначе retry молча бил бы не по тому кэш-ключу». `useMovieCatalog.ts`/`invalidateMovieCatalog` — прямой прецедент: там инвалидатор пересчитывает те же параметры (`filters`, `sort`, `page`), что и хук чтения, из тех же синхронно доступных входов. Для рекомендаций так не получится буквально: вход правила (`favorites: Movie[]`) сам приходит из Suspense-запроса, недоступен синхронно снаружи `AsyncBoundary`. Решение — companion-инвалидатор `invalidateRecommendations` в том же файле, что и `useRecommendedMovies`, с module-level запоминанием последнего вычисленного `query` (см. Technical Details).
- **Изоляция кэша в тестах** — `getMoviesPage`'s `pageCache` — приватный module-level `Map`, НЕ очищается глобальным `afterEach(resetAllCachedFetchers)` из `src/test/setup.ts` (проверено чтением `getMoviesPage.ts`/`setup.ts`). `getMoviesPage.test.ts`/`useMovieCatalog.test.tsx` обходят это через `vi.resetModules()` + динамический импорт в каждом тесте. Т.к. `query` в рекомендациях детерминирован из набора `favorites`, тесты с одинаковым набором избранного в одном файле иначе разделят кэш-ключ и второй тест тихо получит промис первого — тот же приём обязателен здесь.
- **Nav-интеграция** (решено в вопросах ниже): `BottomNav` (`src/widgets/mobile-chrome/ui/BottomNav/`) — фиксированная CSS-сетка `repeat(5, 1fr)` с пятью пунктами (`home/search/lists/popular/profile`, `profile` — disabled-заглушка, `path: null`); расширяем до 6 колонок, `profile` остаётся как есть. Иконка — переиспользуем `StarIcon` (`@shared/ui`, сигнатура `{size?, filled?}` уже совместима с паттерном `<Icon size={20} filled={isActive}/>` в `BottomNav`), новую иконку заводить не нужно.

### Решения из уточняющих вопросов

- **Nav-размещение**: расширить `BottomNav` до 6 колонок (не заменять `profile`-заглушку, не ограничиваться только desktop `Header`).
- **Формула рейтинга**: `rating.kp = [\`\${avg - 1}-10\`]` — буфер `-1` для более широкой выдачи (не точное среднее).
- **Тестирование**: Regular (сначала код, потом тесты) — как в остальных задачах Фазы 2.

## Development Approach

- **Testing approach**: Regular (сначала реализация, потом тесты — как в остальных задачах Фазы 2 этого проекта).
- Каждая задача — один логический юнит, полностью завершается (включая тесты и `make test`) перед переходом к следующей.
- **CRITICAL**: каждая задача включает тесты — это обязательная часть чеклиста, не опция.
- **CRITICAL**: все тесты (и типы — `make check` включает `tsc -b`) должны проходить перед стартом следующей задачи. Порядок задач ниже выстроен так, чтобы ни один промежуточный коммит не ломал typecheck (см. заметку у Task 3).
- **CRITICAL**: обновлять этот файл при отклонении от исходного скоупа.
- Переиспользовать существующие паттерны (`PopularDesktop`/`FavoritesDesktop`, `useMovieCatalog`) буквально, не изобретать новые.

## Testing Strategy

- **Unit-тесты**: обязательны для каждой задачи (см. Development Approach). Особый акцент на `computeRecommendationQuery` — чистая функция, покрывается табличными тестами на топ-3 жанра/средний рейтинг/exclude/сортировку/edge cases.
- **Компонентные тесты**: smoke + a11y через `@testing-library/react` + MSW (`onUnhandledRequest: 'error'` — подтверждает отсутствие сетевого запроса в empty-state-без-избранного сценарии). Тесты на exclude/genre/rating утверждают через захват `request.url` в MSW-хендлере фактические query-параметры исходящего запроса (`id`, `genres.name`, `rating.kp`, `sortField`), а не только состав ответа — иначе тест не отличит «правило сработало» от «фикстура случайно не содержит избранных id».
- **Изоляция `pageCache`**: тесты, дергающие `getMoviesPage` через `useRecommendedMovies`/UI-компоненты, либо используют уникальный набор избранных id на тест, либо `vi.resetModules()` + динамический импорт (как в `useMovieCatalog.test.tsx`) — фиксируется явно в чеклистах Task 2/4/5.
- **E2E**: в проекте нет Playwright (это roadmap-пункт 2.5.5, ещё не сделан) — E2E не требуется в рамках этого плана.

## Progress Tracking

- Отмечать выполненные пункты `[x]` сразу по завершении.
- Новые обнаруженные задачи — с префиксом ➕.
- Блокеры — с префиксом ⚠️.

## Solution Overview

Слой | Ответственность
---|---
`src/features/recommendations/lib/computeRecommendationQuery.ts` | Чистое правило: `Movie[]` (избранное) → `NonNullable<CatalogParams> \| null`
`src/features/recommendations/index.ts` | Публичный API среза (экспорт `computeRecommendationQuery`)
`src/pages/recommendations/model/useRecommendedMovies.ts` | Композиция `useFavoriteMovies()` + `computeRecommendationQuery()` + `getMoviesPage()` — page-slice facade; экспортирует также companion-инвалидатор `invalidateRecommendations(ids)`
`src/pages/recommendations/ui/RecommendationsDesktop/` `.../RecommendationsMobile/` | UI, зеркалит `PopularDesktop`/`PopularMobile` + double-empty-state паттерн `FavoritesDesktop`; без кнопки-сердечка (см. Technical Details)
`src/pages/recommendations/RecommendationsPage.tsx` + `index.tsx` | viewport-переключатель, паттерн `PopularPage`
`src/app/router.tsx` | добавление `/recommendations`
`Header.tsx` / `BottomNav.tsx` | nav-пункт «Picks»

**Ключевое архитектурное решение**: `computeRecommendationQuery` возвращает `null`, когда на входе пустой `favorites` (после `getMoviesByIds` — часть избранных id могла 404-нуться и список оказался пуст, даже если `ids.length > 0`). `useRecommendedMovies()` пробрасывает это различие дальше: `null` → «не удалось построить рекомендации по избранному», `[]` (запрос выполнился, но каталог ничего не вернул) → «пока нечего порекомендовать». Так UI различает два разных пустых состояния вместо одного общего.

## Technical Details

**`computeRecommendationQuery(favorites: Movie[]): NonNullable<CatalogParams> | null`:**

```
если favorites.length === 0 → null

genreCounts = частота movie.genre по всем favorites (Movie.genre — уже русские названия
              из mapDocToMovie, ровно то, что ожидает 'genres.name' — без перевода, как
              и в filtersToParams.ts)
topGenres = 3 самых частых жанра (ties — по порядку первого появления)

ratedFavorites = favorites с rating > 0
avgRating = среднее по ratedFavorites.rating (если ratedFavorites пуст — 'rating.kp' не добавляется)
ratingFloor = max(0, avgRating - 1)   // буфер −1, решено в Q&A

params = {
  id: favorites.map(m => `!${m.id}`),               // exclude favoriteIds
  sortField: ['rating.kp'],
  sortType: ['-1'],
  ...(topGenres.length > 0 ? { 'genres.name': topGenres } : {}),
  ...(ratedFavorites.length > 0 ? { 'rating.kp': [`${ratingFloor.toFixed(1)}-10`] } : {}),
}
```

Без `limit`: `fetchCursorStep` (`getMoviesPage.ts`) безусловно перезаписывает `limit` на `PER_PAGE` (`...params, limit: PER_PAGE`) — любое значение `limit` в `params` тихо игнорируется. Указывать его в правиле — мёртвый код, создающий ложное впечатление, что размер страницы управляется правилом; фактический размер — `PER_PAGE` (12).

Без `type`: правило не ограничивает `type` — избранное только из фильмов может порекомендовать аниме/сериал. Осознанный accepted default (тот же принцип, что RU-жанры на дисплее / `MovieInListDto` без `type` в `mapDocToMovie` — см. AGENTS.md), не баг.

**Retry / инвалидация.** `useRecommendedMovies` запоминает последний вычисленный `query` в module-level переменной (тот же файл — не экспортируется отдельно, только через инвалидатор), т.к. в отличие от `useMovieCatalog` (где `filters`/`sort`/`page` синхронно доступны месту вызова `onRetry`) вход правила (`favorites`) сам приходит из Suspense и недоступен снаружи `AsyncBoundary`:

```ts
let lastQuery: NonNullable<CatalogParams> | null = null

export const useRecommendedMovies = (): Movie[] | null => {
  const favorites = useFavoriteMovies()
  const query = computeRecommendationQuery(favorites)
  lastQuery = query
  if (!query) return null
  const { movies } = use(getMoviesPage(query, 1))
  return movies
}

// Companion-инвалидатор для Retry (тот же паттерн, что invalidateMovieCatalog/invalidateMovieDetail —
// см. AGENTS.md): чистит и кэш favorites-фетча, и кэш каталожного шага по ПОСЛЕДНЕМУ вычисленному
// query — иначе retry (roadmap 1.6, "retry действительно перезапрашивает") бил бы только по кэшу
// favorites, а getMoviesPage(query, 1) продолжал бы отдавать закэшированный rejected-промис ещё
// до 20с (ERROR_CACHE_TTL_MS) — ровно доминирующий сценарий отказа (403 демо-квоты) остаётся не
// перезапрошен, а Retry-кнопка выглядит нерабочей.
export const invalidateRecommendations = (ids: number[]): void => {
  getMoviesByIds.invalidate(ids)
  if (lastQuery) invalidateMoviesPage(lastQuery, 1)
}
```

`lastQuery` пишется как побочный эффект во время рендера — тот же приём уже используют кэши `pageCache`/`createCachedFetcher` (мутация module-level `Map` внутри функции, вызываемой из `use()` во время рендера); идемпотентно (перезапись тем же значением при повторном рендере/StrictMode-double-invoke безвредна), отдельного эффекта не требует.

**Без кнопки-избранного на этой странице.** `Card`/`MobileCard` получают `isFavorite`/`onToggleFavorite` — оба `undefined`, сердечко не рендерится (задокументированное поведение по умолчанию в AGENTS.md). Причина: передача `toggle` сюда меняла бы `ids` в `useFavorites()` при каждом клике по сердечку → новый кэш-ключ `getMoviesByIds(ids)` → весь грид уходит в Suspense заново → новый `computeRecommendationQuery` → новый запрос `getMoviesPage` — полный skeleton-flash и пересчёт подборки на каждый клик, плюс лишние запросы к demo-квоте (200/сутки). Осознанный trade-off: добавить фильм в избранное отсюда всё ещё можно через переход на его детальную страницу (stretched-link `Card`/`MobileCard` уже ведёт на `/movie/:id`).

## What Goes Where

- **Implementation Steps** (`[ ]`): код, тесты, обновление документации.
- **Post-Completion**: ручная проверка UX, нет — весь скоуп покрывается кодом ниже.

## Implementation Steps

### Task 1: Pure-функция правила рекомендаций

**Files:**

- Create: `src/features/recommendations/lib/computeRecommendationQuery.ts`
- Create: `src/features/recommendations/lib/computeRecommendationQuery.test.ts`
- Create: `src/features/recommendations/index.ts`

- [x] создать `computeRecommendationQuery(favorites: Movie[]): NonNullable<CatalogParams> | null` в `src/features/recommendations/lib/computeRecommendationQuery.ts` по формуле из Technical Details (топ-3 жанра, `avg − 1` с клампом снизу в 0, `id: ['!<id>', ...]`, `sortField: ['rating.kp'], sortType: ['-1']`, БЕЗ `limit`)
- [x] экспортировать `computeRecommendationQuery` из `src/features/recommendations/index.ts` (публичный API среза — `import { computeRecommendationQuery } from '@features/recommendations'`)
- [x] написать тесты: топ-3 жанра по частоте среди >3 уникальных жанров; средний рейтинг с буфером −1 (в т.ч. кламп к 0 при низком среднем); `id` содержит `!<id>` для каждого избранного; `sortField`/`sortType` присутствуют всегда; пустой `favorites` → `null`
- [x] написать тесты на edge cases: фильм без жанров/с `rating: 0` не ломает подсчёт (пропускается, а не считается за 0); все избранные фильмы без рейтинга → `rating.kp` не добавляется в результат; все избранные фильмы без жанров → `genres.name` не добавляется; результат никогда не содержит поле `limit`
- [x] прогнать `make test` — должны проходить

### Task 2: Page-model facade `useRecommendedMovies` + инвалидатор

**Files:**

- Create: `src/pages/recommendations/model/useRecommendedMovies.ts`
- Create: `src/pages/recommendations/model/useRecommendedMovies.test.tsx`

- [x] создать `useRecommendedMovies(): Movie[] | null` в `src/pages/recommendations/model/` — композиция `useFavoriteMovies()` (`@features/favorites`, Suspense) → `computeRecommendationQuery()` (`@features/recommendations`) → при `null` вернуть `null` сразу, иначе `use(getMoviesPage(query, 1)).movies` (`@entities/movie`); живёт в page-слое, а не в `@entities`/`@features`, т.к. композирует два независимых downward-среза — тот же паттерн, что `useMovieCatalog` (см. AGENTS.md, "Page-slice model/ facade")
- [x] в том же файле — module-level `lastQuery` + `invalidateRecommendations(ids: number[]): void`, вызывающий `getMoviesByIds.invalidate(ids)` и (если `lastQuery` не `null`) `invalidateMoviesPage(lastQuery, 1)` — companion-инвалидатор для Retry, дизайн зафиксирован в Technical Details
- [x] написать тест: непустые favorites с жанрами/рейтингом → хук возвращает список фильмов; тест перехватывает исходящий запрос в MSW-хендлере (`request.url`) и утверждает, что query-параметры реально содержат `id=!<favoriteId>` для каждого избранного, ожидаемые `genres.name` и `rating.kp` — а не просто проверяет состав ответа (server-side exclusion иначе даёт тест, который не может упасть)
- [x] написать тест: favorites резолвится в `[]` (все id вернули 404 в `getMoviesByIds`) → хук возвращает `null`, без обращения к `getV15Movie` (MSW `onUnhandledRequest: 'error'` подтверждает отсутствие лишнего запроса)
- [x] написать тест на `invalidateRecommendations`: после успешного рендера хука (query вычислен и закэширован) вызов инвалидатора реально сбрасывает `pageCache`-запись для `(lastQuery, 1)` — следующий `getMoviesPage` идёт в сеть заново, а не отдаёт старый промис
- [x] использовать `vi.resetModules()` + динамический импорт (как в `useMovieCatalog.test.tsx`) или уникальный набор favorite id на тест — во избежание пересечения по `getMoviesPage`'s module-level `pageCache` между тестами этого файла (см. Testing Strategy)
- [x] прогнать `make test` — должны проходить

### Task 3: Nav-интеграция (Header + BottomNav)

Идёт раньше UI-страниц намеренно: `BottomNav.tsx`'s `NavKey` — закрытый union `'home' | 'search' | 'lists' | 'popular' | 'profile'`. Если сначала сделать `RecommendationsMobile` (использует `<BottomNav active='recommendations' />`) и только потом расширить `NavKey`, `make typecheck`/`make build`/`make check` будут падать между задачами — Vitest их не ловит (не тайпчекает), поэтому разрыв станет виден только на верификации. Эта задача расширяет `NavKey` первой, до того как он кому-то понадобится.

**Files:**

- Modify: `src/widgets/header/ui/Header/Header.tsx`
- Modify: `src/widgets/header/ui/Header/Header.test.tsx`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.tsx`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.module.css`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.test.tsx`

- [x] добавить `{ key: 'recommendations', label: 'Picks', path: '/recommendations' }` в `navItems` в `Header.tsx` (после `popular`); однословный лейбл — сознательно, см. следующий пункт
- [x] расширить `NavKey` в `BottomNav.tsx` до `'home' | 'search' | 'lists' | 'popular' | 'recommendations' | 'profile'`; добавить пункт `{ key: 'recommendations', label: 'Picks', icon: StarIcon, path: '/recommendations' }` между `popular` и `profile`; импортировать `StarIcon` из `@shared/ui`. Лейбл — одно слово (`Picks`, не «For You»): `.navLabel` в `BottomNav.module.css` — 9.5px моно, uppercase, `letter-spacing: 0.1em`, без `white-space: nowrap`; при 6 колонках на 320-360px viewport на пункт остаётся ~44-50px, двухсловный лейбл перенесётся на вторую строку и изменит высоту нав-бара
- [x] `BottomNav.module.css`: `.grid { grid-template-columns: repeat(5, 1fr) }` → `repeat(6, 1fr)`; добавить `.navLabel { white-space: nowrap }` (защита от переноса при длинных лейблах в целом, не только для нового пункта) — решение расширить сетку (а не заменить `profile`-заглушку) зафиксировано в Q&A выше
- [x] обновить `BottomNav.test.tsx`: `renderWithProbe`-union добавляет `'recommendations'`; тест "5 колонок" переименовать/переписать на "6 колонок" (`toHaveLength(6)`); добавить тесты клика/active-подсветки пункта "Picks" → `/recommendations`
- [x] обновить/добавить `Header.test.tsx`: по образцу `describe('Header — пункт навигации Popular', ...)` — новый `describe('Header — пункт навигации Picks', ...)` с тестами клика (`/recommendations`) и активной подсветки при `activeNav='recommendations'`
- [x] прогнать `make test` и `make typecheck` — должны проходить

### Task 4: `RecommendationsDesktop`

**Files:**

- Create: `src/pages/recommendations/ui/RecommendationsDesktop/RecommendationsDesktop.tsx`
- Create: `src/pages/recommendations/ui/RecommendationsDesktop/RecommendationsDesktop.module.css`
- Create: `src/pages/recommendations/ui/RecommendationsDesktop/index.tsx`
- Create: `src/pages/recommendations/ui/RecommendationsDesktop/RecommendationsDesktop.test.tsx`

- [ ] `useFavorites().ids.length === 0` → `EmptyState` (title: «No favorites yet», description: «Add movies you like to get recommendations» — согласовано по тону с `FavoritesDesktop.tsx`) без сетевого запроса — гейт до `AsyncBoundary`, паттерн `FavoritesDesktop.tsx`
- [ ] иначе `<AsyncBoundary fallback={<Skeleton-грид>} onRetry={() => invalidateRecommendations(ids)}>` вокруг внутреннего `RecommendationsGrid` (companion-инвалидатор из Task 2, не голый `getMoviesByIds.invalidate`)
- [ ] `RecommendationsGrid`: `useRecommendedMovies()` → `null` рендерит `EmptyState` (title: «Couldn't load your favorites», тот же текст, что в `FavoritesDesktop.tsx`), `[]` рендерит `EmptyState` (title: «Nothing to recommend yet», description: «Add a few more favorites to help us find matches»), иначе грид `Card` (`variant='grid'`, БЕЗ `isFavorite`/`onToggleFavorite` — см. Technical Details) — паттерн `PopularDesktop.tsx`/`FavoritesDesktop.tsx`
- [ ] `<Header activeNav='recommendations' />` + заголовок «Recommended for you»
- [ ] написать тесты: `ids.length === 0` → empty-state рендерится без единого сетевого вызова; успешный кейс — MSW-хендлер перехватывает `request.url` и подтверждает, что фактический запрос содержит `id=!<favoriteId>` (а не просто проверяет состав ответа); `useRecommendedMovies` возвращает `null`/`[]` → соответствующий `EmptyState`; клик по Retry в error-состоянии вызывает `invalidateRecommendations`, а не только инвалидацию favorites
- [ ] использовать `vi.resetModules()`/уникальные id на тест для изоляции `pageCache` (см. Testing Strategy)
- [ ] прогнать `make test` — должны проходить

### Task 5: `RecommendationsMobile`

**Files:**

- Create: `src/pages/recommendations/ui/RecommendationsMobile/RecommendationsMobile.tsx`
- Create: `src/pages/recommendations/ui/RecommendationsMobile/RecommendationsMobile.module.css`
- Create: `src/pages/recommendations/ui/RecommendationsMobile/index.tsx`
- Create: `src/pages/recommendations/ui/RecommendationsMobile/RecommendationsMobile.test.tsx`

- [ ] зеркалит `RecommendationsDesktop` (Task 4), но с `MobileCard` (без `variant`, без `isFavorite`/`onToggleFavorite`), `<MobileHeader title='Recommended for you' />` + `<BottomNav active='recommendations' />` — паттерн `PopularMobile.tsx`/`FavoritesMobile.tsx`
- [ ] переиспользовать `useRecommendedMovies()`/`invalidateRecommendations()`/`useFavorites()` из `src/pages/recommendations/model/` — никакой отдельной data-логики для mobile (см. roadmap 2.5 "Как лучше")
- [ ] те же три состояния, что в Desktop: gate по `ids.length===0`, `null`/`[]` от хука, тот же текст EmptyState
- [ ] написать тесты: те же сценарии, что в Task 4 (включая MSW-проверку query-параметров и Retry → `invalidateRecommendations`), применительно к `MobileCard`/`BottomNav`
- [ ] использовать `vi.resetModules()`/уникальные id на тест для изоляции `pageCache`
- [ ] прогнать `make test` — должны проходить

### Task 6: `RecommendationsPage` + роутинг

**Files:**

- Create: `src/pages/recommendations/RecommendationsPage.tsx`
- Create: `src/pages/recommendations/index.tsx`
- Create: `src/pages/recommendations/RecommendationsPage.test.tsx`
- Modify: `src/app/router.tsx`

- [ ] `RecommendationsPage` — `useViewport().isMobile` переключает `RecommendationsDesktop`/`RecommendationsMobile`, паттерн `PopularPage.tsx`
- [ ] `index.tsx` — `export { RecommendationsPage } from './RecommendationsPage'`
- [ ] добавить `{ path: '/recommendations', element: <RecommendationsPage /> }` в `src/app/router.tsx` (после `/popular`)
- [ ] написать smoke-тест переключения `Desktop`/`Mobile` по замоканному `useViewport`
- [ ] прогнать `make test` — должны проходить

### Task 7: Verify acceptance criteria

- [ ] `features/recommendations/` создан, экспортирует `computeRecommendationQuery`
- [ ] `computeRecommendationQuery` покрыта юнит-тестами (топ-3 жанра, средний рейтинг, exclude favoriteIds, сортировка, edge cases, отсутствие `limit`)
- [ ] `useRecommendedMovies()` + `invalidateRecommendations()` существуют и переиспользуются между Desktop/Mobile
- [ ] `/recommendations` рендерит empty-state «No favorites yet» при пустом избранном, без сетевого запроса
- [ ] `/recommendations` добавлен в `Header`/`BottomNav` (roadmap 2.8), лейблы не переносятся на 320px viewport
- [ ] `make check` (lint + typecheck + build) проходит — включая промежуточные состояния между задачами (проверить, что Task 3 действительно устраняет typecheck-разрыв, а не просто переносит его)
- [ ] `make test` — полный набор проходит
- [ ] вручную: `make dev` → добавить 2-3 фильма разных жанров в избранное → открыть `/recommendations` → рекомендации не содержат избранных id, отсортированы по рейтингу; нажать Retry в разработческом error-состоянии (если удаётся спровоцировать) → реально уходит новый сетевой запрос, а не старый rejected-промис

### Task 8: Обновление документации

- [ ] обновить `AGENTS.md`: строку "Routes" (добавить `/recommendations`), таблицу "Key public APIs" (строка `@features/recommendations` → `computeRecommendationQuery()`), раздел "Data state" — короткая заметка, что рекомендации переиспользуют `getMoviesPage` без нового API-слоя, композиция favorites+rule живёт в `pages/recommendations/model/` (аналог `useMovieCatalog`), включая companion-инвалидатор `invalidateRecommendations` (аналог `invalidateMovieCatalog`)
- [ ] в этой же заметке зафиксировать, что хук назван `useRecommendedMovies` (не `useRecommendations`, как в буквальной формулировке roadmap 2.4) — осознанное отклонение, т.к. `useFavorites`/`useFavoriteMovies` уже задают в проекте конвенцию «`use<Domain>` — сырые данные, `use<Domain>Movies` — Suspense-хук с фильмами»
- [ ] зафиксировать, что `FeatureName` в `src/shared/config/features/useFeatureFlag.ts` уже содержит `recommendations: false` без единого потребителя — этой фиче флаг сознательно не подключается (тот же прецедент, что `popularThisWeek`/`toggleTheme`, оставленные `false` после релиза соответствующих фич)
- [ ] отметить пункт `2.4 Recommendations 🎯 (rule-based)` в `plans/roadmap.md` как `[x]` (по аналогии с 2.3 — дописать "— done, см. `docs/plans/20260825-recommendations-rule-based.md`"), отметить `/recommendations` в 2.8 как сделанный
- [ ] переместить этот файл в `docs/plans/completed/`

## Post-Completion

Нет пунктов, требующих внешних систем — вся работа укладывается в кодовую базу текущего репозитория.
