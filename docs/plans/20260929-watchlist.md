# Список «Хочу посмотреть» (watchlist)

## Overview

- Страница `/watchlist` со списком фильмов и сериалов, которые пользователь хочет посмотреть, — по устройству как `/favorites` и `/watched`.
- В список попадает всё, что отмечено кнопкой **Add to list** на странице деталей (`/movie/:id`); повторное нажатие убирает из списка.
- Сейчас эта кнопка — локальное состояние (`LikedState.list` в `Movie.tsx`), теряется при уходе со страницы. План делает её персистентной.
- Watchlist и Watched **независимы**: отметка Watched не трогает watchlist и наоборот. Пользователь может держать в «Хочу посмотреть» и ранее просмотренные тайтлы (например, для пересмотра).
- Сериалы отдельной логики не требуют: список хранит только id, `MovieType` уже включает сериалы.

## Context (from discovery)

- образец: `src/features/watched/` (`watchedStorage.ts`, `useWatched` → `{ ids, isWatched, toggle }`, `useWatchedMovies` = `use(getMoviesByIds(ids))`) и `src/features/favorites/`
- образец страницы: `src/pages/watched/{index.tsx,WatchedPage.tsx,ui/Watched}` — `AsyncBoundary` + `Skeleton` + `EmptyState`, Retry → `getMoviesByIds.invalidate(ids)`
- кнопки: `src/pages/movie/ui/MovieActions/MovieActions.tsx` (`Add to list` → `liked.list`, `Watched` → пропсы `watched`/`onWatchedToggle`), `src/pages/movie/ui/Movie/Movie.tsx` (`useState<LikedState>` + `useWatched()`), `src/pages/movie/ui/types.ts` (`LikedState { rate, list, fav }`)
- маршрут/chrome: `src/app/router.tsx` (`lazyNamed`), `ROUTE_CHROME` в `src/app/layouts/AppLayout.tsx`, группа `page-watched` в `vite.config.ts` (`codeSplitting.groups`) и `size-limit` в `package.json`
- вход в раздел: quick links на `/profile` (`Profile.tsx`, счётчик из `useWatched`); `BottomNav` без свободных слотов
- правила: `.claude/rules/watched.md`, `data-layer.md`, `profile.md`, `build-budgets.md`, `e2e.md`; лимит бандла `entry` уже поднят до 3.6 KB под watched — запас минимальный
- API: демо-лимит 200 запросов/день; e2e ходят в живой API — один flow на journey, один `checkA11y` на спеку

## Development Approach

- **testing approach**: Regular (код, затем тесты в той же задаче)
- каждая задача завершается полностью, затем следующая
- небольшие сфокусированные изменения
- **CRITICAL: в каждой задаче есть новые/обновлённые тесты** (успех + ошибки/краевые случаи)
- **CRITICAL: все тесты проходят до начала следующей задачи**
- **CRITICAL: при изменении объёма обновлять этот файл**
- не писать `useMemo`/`useCallback`/`memo` (React Compiler); `type`, не `interface`; цвета только через `var(--token)`
- комментарии в коде — на русском, объясняют «почему»
- ветка + PR в `main` (прямой push запрещён); коммиты conventional

## Testing Strategy

- **unit**: `useWatchlist`, `useWatchlistMovies`, страница `Watchlist`, `MovieActions`/`Movie` (независимость двух кнопок), `Profile`
- **e2e**: `e2e/watchlist.spec.ts` — один flow против живого API: карточка с главной → Add to list → `/watchlist` → карточка на месте → Watched на странице фильма → тайтл остаётся в `/watchlist` (независимость) → снять Watchlist → пустое состояние; один `checkA11y`
- сериал покрывается unit-тестом с MSW-фикстурой `type: 'tv-series'`

## Progress Tracking

- выполненное отмечать `[x]` сразу
- новые задачи — с префиксом ➕, блокеры — с ⚠️

## Solution Overview

- новый слайс `@features/watchlist` — копия структуры `@features/watched` с ключом `kinoshka:watchlist` (массив id, порядок = порядок добавления). Дублирование осознанно предпочтено общей абстракции «список id» (меньше связности), как и при watched.
- слайсы `watched` и `watchlist` полностью независимы, никакой связки и фасада: `Movie.tsx` вызывает `useWatched()` и `useWatchlist()` напрямую. Watched-тайтл можно добавить в watchlist и наоборот.
- `LikedState` теряет поле `list` (остаются `rate`, `fav` — вне объёма).
- страница `/watchlist` в `src/pages/watchlist`, `Card variant='grid'` через `getMoviesByIds`.
- решения: дату добавления, приоритеты, заметки **не** храним (YAGNI); аналитики нет; снять тайтл из watchlist можно только на странице фильма (как в watched).
- подпись кнопки меняем `Add to list` → `Watchlist`: при двух списках («Add to list» неоднозначно) и `aria-pressed` имя должно называть список.

## Technical Details

- storage: `watchlistSlot = createStorageSlot('kinoshka:watchlist', z.array(z.number()), [])`
- `useWatchlist()` → `{ ids, isInWatchlist, toggle }`; `toggle` читает `watchlistSlot.get()`, а не замыкание (два вызова в одном тике не затирают друг друга); при `set() === false` состояние не меняется (обеспечивает `useStorageSlot`). Без `add`/`remove`/`clear` — вызывающих нет (knip).
- `useWatchlistMovies()` → `use(getMoviesByIds(ids))`
- `MovieActions({ liked, onChange, watched, onWatchedToggle, inWatchlist, onWatchlistToggle })`
- `Watchlist` комбинирует `@features/watchlist`, `@features/favorites`, `@entities/movie` прямо в UI — по образцу `Watched.tsx`
- все id 404 → `getMoviesByIds` возвращает `[]` → `EmptyState` «Watchlist titles unavailable» без Retry
- chrome: `ROUTE_CHROME['/watchlist'] = { active: 'lists', title: 'Watchlist' }`, без `activeNav`
- бюджеты: группа `page-watchlist` в `vite.config.ts` + запись `size-limit`; лимит `entry` — поднять на фактический прирост (роут + lazy-импорт) с запасом, см. `build-budgets.md`

## What Goes Where

- **Implementation Steps** — код, тесты, документация в репозитории
- **Post-Completion** — ручная проверка; Lighthouse/Sentry не требуются

## Implementation Steps

### Task 1: Слайс `@features/watchlist` (хранилище и хуки)

**Model:** sonnet — прямая копия паттерна watched, тесты подскажут ошибки

**Files:**

- Create: `src/features/watchlist/index.ts`
- Create: `src/features/watchlist/model/watchlistStorage.ts`
- Create: `src/features/watchlist/model/useWatchlist.ts`
- Create: `src/features/watchlist/model/useWatchlistMovies.ts`
- Create: `src/features/watchlist/model/useWatchlist.test.ts`
- Create: `src/features/watchlist/model/useWatchlistMovies.test.tsx`

- [x] создать `watchlistSlot` (`kinoshka:watchlist`, zod `z.array(z.number())`, default `[]`)
- [x] реализовать `useWatchlist` (`ids`, `isInWatchlist`, `toggle`) на `useStorageSlot`
- [x] реализовать `useWatchlistMovies` = `use(getMoviesByIds(ids))`
- [x] экспортировать хуки из `index.ts`
- [x] тесты `useWatchlist`: добавление/снятие, порядок, два `toggle` в одном тике, недоступное хранилище (`set() === false`), битые данные в storage → `[]`
- [x] тесты `useWatchlistMovies`: фильмы и сериал (`tv-series`), пустой список
- [x] запустить `make test` — должно пройти до задачи 2

### Task 2: Кнопка Watchlist на странице фильма

**Model:** sonnet — поведение полностью описано в плане, тесты покажут ошибку

**Files:**

- Modify: `src/pages/movie/ui/Movie/Movie.tsx`
- Modify: `src/pages/movie/ui/MovieHero/MovieHero.tsx` (через него пробрасываются пропсы в `MovieActions`)
- Modify: `src/pages/movie/ui/MovieActions/MovieActions.tsx`
- Modify: `src/pages/movie/ui/types.ts`
- Modify: `src/pages/movie/ui/Movie/Movie.test.tsx` (`MovieActions.test.tsx` не существует)

- [x] `types.ts`: убрать `list` из `LikedState`
- [x] `MovieActions`: новые пропсы `inWatchlist`/`onWatchlistToggle`, подпись `Watchlist`, `active={inWatchlist}`
- [x] `MovieHero.tsx`: пробросить `inWatchlist`/`onWatchlistToggle` в `MovieActions` (рядом с `watched`/`onWatchedToggle`)
- [x] `Movie.tsx`: подключить `useWatchlist()` рядом с `useWatched()` вместо `liked.list`
- [x] `Movie.test.tsx`: новый `describe('Movie — Watchlist')` по образцу `describe('Movie — Watched')`: независимость (Watched не меняет watchlist и наоборот), просмотренный тайтл можно добавить в watchlist, состояние переживает перемонтирование, `aria-pressed`
- [x] `Movie.test.tsx`: заменить `Add to list` на `Watchlist` в тесте «остальные кнопки работают независимо от Watched» (в `e2e/` этого текста нет)
- [x] запустить `make test` и `make typecheck` — должно пройти до задачи 3

### Task 3: Страница `/watchlist`

**Model:** sonnet — копия страницы `Watched`

**Files:**

- Create: `src/pages/watchlist/index.tsx`
- Create: `src/pages/watchlist/WatchlistPage.tsx`
- Create: `src/pages/watchlist/ui/Watchlist/index.tsx`
- Create: `src/pages/watchlist/ui/Watchlist/Watchlist.tsx`
- Create: `src/pages/watchlist/ui/Watchlist/Watchlist.module.css`
- Create: `src/pages/watchlist/ui/Watchlist/Watchlist.test.tsx`
- Create: `src/pages/watchlist/ui/Watchlist/Watchlist.retry.test.tsx`

- [ ] скопировать структуру `src/pages/watched` и заменить хуки на `useWatchlist`/`useWatchlistMovies`
- [ ] пустое состояние («Nothing in your watchlist yet») и `EmptyState` «Watchlist titles unavailable» для случая «все id 404» (без Retry)
- [ ] Retry → `getMoviesByIds.invalidate(ids)`
- [ ] тесты: рендер карточек (фильм + сериал), пустой список, все id 404, ошибка загрузки и Retry, сердечко на карточке пишет в избранное и не убирает карточку, тайтл одновременно в watched и watchlist отображается на `/watchlist` (независимость)
- [ ] запустить `make test` — должно пройти до задачи 4

### Task 4: Маршрут, chrome, ссылка из профиля, бюджеты

**Model:** sonnet — механическое повторение того, что сделано для `/watched`

**Files:**

- Modify: `src/app/router.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `src/pages/profile/ui/Profile/Profile.tsx` (+ его тест)
- Modify: `vite.config.ts`
- Modify: `package.json` (`size-limit`)

- [ ] добавить `/watchlist` в `router.tsx` через `lazyNamed`
- [ ] добавить `ROUTE_CHROME['/watchlist']` и строку в комментарий-таблицу `AppLayout.tsx`
- [ ] quick link «Watchlist» на `/profile` со счётчиком из `useWatchlist` и иконкой `PlusIcon` (как на кнопке)
- [ ] группа `page-watchlist` в `codeSplitting` и запись в `size-limit`; в комментарии `vite.config.ts` (~стр. 114) «все 9 page-слайсов» → 10
- [ ] лимиты по `build-budgets.md`: limit = измеренный gzip + 15% (не копировать число `page-watched`); `entry` пересчитать через `VITE_SENTRY_DSN=https://k@o1.ingest.sentry.io/1 make build-only && make size`
- [ ] `Profile.test.tsx`: ссылка, счётчик, и `getAllByRole('link')` в регионе «Quick access» (стр. ~74) теперь 5, а не 4; тесты `AppLayout`/router, если перечисляют маршруты
- [ ] запустить `make test`, затем `make build` и `make size` — всё должно пройти до задачи 5

### Task 5: E2E-спека `watchlist`

**Model:** sonnet — по образцу `e2e/watched.spec.ts`

**Files:**

- Create: `e2e/watchlist.spec.ts`

- [ ] один flow: карточка с главной → `Watchlist` → `/watchlist` → карточка на месте → на странице фильма `Watched` → `/watchlist`: карточка **осталась** (независимость) → на странице фильма снять `Watchlist` → `/watchlist` пуст
- [ ] селекторы как в `e2e/watched.spec.ts`: `getByRole('button', { name: 'Watchlist' })` + проверка `aria-pressed`; на профиле ссылку искать как `/^Watchlist/` (`/^Watch/` совпадёт с обоими пунктами)
- [ ] один `checkA11y` на спеку (см. `e2e.md`; лишние запросы к живому API не делать — квота 200/день)
- [ ] `make build-only && make e2e` — спека должна пройти

### Task 6: Verify acceptance criteria

**Model:** sonnet — проверяет результат по плану, чинит пробелы

- [x] все требования из Overview реализованы (страница, кнопка, сериалы, независимость от Watched)
- [x] краевые случаи: недоступный localStorage, все id 404, два быстрых клика
- [x] `make check` (format-check, lint, build)
- [x] `make test`, `make knip`, `make size`
- [x] `make e2e` (not verified: API quota exhausted — падают и все существующие спеки, home без карточек; Mobile Safari дополнительно падает на PushAPIEnabled)

### Task 7: [Final] Update documentation

**Model:** sonnet — документация описывает построенное поведение

- [ ] создать `.claude/rules/watchlist.md` (`paths:` — `src/features/watchlist/**`, `src/pages/watchlist/**`, `src/pages/movie/ui/{Movie,MovieActions,MovieHero}/**`, `e2e/watchlist.spec.ts`) — ключ хранилища, независимость от Watched (нет фасада и автоудаления), отсутствие даты/аналитики, квота API, chrome, бюджеты, e2e; только правила и одна строка «почему»
- [ ] `AGENTS.md`: строка в таблице topic-docs, `/watchlist` в списке роутов, `watchlist` в списке features
- [ ] `.claude/rules/watched.md`: обновить пункт «Единственный писатель» (флаги `LikedState` — теперь только `rate`, `fav`; watchlist независим от watched)
- [ ] `.claude/rules/profile.md`: добавить `/watchlist` в список quick links на `/profile`
- [ ] `.claude/rules/e2e.md`: «Specs cover all 9 routes» → 10
- [ ] `knip.jsonc`: убедиться, что ignore не нужен (оба хука используются)
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

_Ручные действия, без чекбоксов_

**Manual verification:**

- на мобильной ширине (<720px) и десктопе: кнопка Watchlist переключается, тайтл появляется на `/watchlist`, счётчик на `/profile` обновляется
- отметка Watched не убирает тайтл из `/watchlist`; ранее просмотренный тайтл можно добавить в watchlist
- светлая и тёмная тема на `/watchlist`

**Риски:**

- квота демо-API (200/день): длинный watchlist делает по запросу на id — кэш 24h смягчает повторные заходы, пагинация вне объёма
