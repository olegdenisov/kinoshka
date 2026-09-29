# Список просмотренных фильмов и сериалов

## Overview
- Страница `/watched` со списком просмотренных фильмов и сериалов — по устройству как `/favorites`.
- В список попадает всё, что пользователь отметил переключателем **Watched** на странице деталей (`/movie/:id`); повторное нажатие убирает из списка.
- Сериалы отдельной логики не требуют: `MovieType` уже включает `tv-series`, `animated-series`, `anime`, `cartoon`, а список хранит только id.
- Сейчас кнопка Watched в `MovieActions` — локальное состояние (`LikedState.watched` в `Movie.tsx`), которое теряется при уходе со страницы. План делает её персистентной.

## Context (from discovery)
- образец: `src/features/favorites/` (`favoritesStorage.ts` — `createStorageSlot('kinoshka:favorites', z.array(z.number()), [])`, `useFavorites`, `useFavoriteMovies` = `use(getMoviesByIds(ids))`)
- образец страницы: `src/pages/favorites/{index.tsx,FavoritesPage.tsx,ui/Favorites}` — `AsyncBoundary` + `Skeleton` + `EmptyState`, Retry → `getMoviesByIds.invalidate(ids)`
- страница деталей: `src/pages/movie/ui/Movie/Movie.tsx` (локальный `useState<LikedState>`), `MovieHero`, `MovieActions`, `ui/types.ts`
- маршрут/chrome: `src/app/router.tsx` (`lazyNamed`), `ROUTE_CHROME` в `src/app/layouts/AppLayout.tsx`, `codeSplitting`-группа в `vite.config.ts` (`output.codeSplitting.groups`) + запись `size-limit` в `package.json`
- ссылки на разделы: quick links на `/profile` (`Profile.tsx`); `BottomNav` без свободных слотов
- API: демо-лимит 200 запросов/день; e2e ходят в **живой API** (без MSW в браузере), поэтому по `e2e.md`: один flow на journey, один `checkA11y` на спеку
- правила: `.claude/rules/data-layer.md`, `profile.md` (storage-слоты), `build-budgets.md`, `e2e.md`

## Development Approach
- **testing approach**: Regular (код, затем тесты в той же задаче)
- каждая задача завершается полностью, затем следующая
- небольшие сфокусированные изменения
- **CRITICAL: в каждой задаче есть новые/обновлённые тесты** (успех + ошибки/краевые случаи)
- **CRITICAL: все тесты проходят до начала следующей задачи**
- **CRITICAL: при изменении объёма обновлять этот файл**
- не писать `useMemo`/`useCallback`/`memo` (React Compiler); `type`, не `interface`; цвета только через `var(--token)`
- комментарии в коде — на русском, объясняют «почему»

## Testing Strategy
- **unit**: хук `useWatched`, `useWatchedMovies`, страница `Watched`, `MovieActions`/`Movie` (Testing Library + MSW, как у favorites)
- **e2e**: `e2e/watched.spec.ts` (Playwright, по образцу `favorites.spec.ts`, живой API, один flow, один `checkA11y`); сериал покрывается unit-тестом с MSW-фикстурой `type: 'tv-series'`

## Progress Tracking
- выполненное отмечать `[x]` сразу
- новые задачи — с префиксом ➕, блокеры — с ⚠️

## Solution Overview
- новый слайс `@features/watched` — копия структуры `@features/favorites` с ключом `kinoshka:watched` (массив id, порядок = порядок отметки)
- `Movie.tsx` берёт `watched` из `useWatched()`, а не из локального состояния; остальные флаги (`rate`, `list`, `fav`) остаются локальными — вне объёма
- страница `/watched` в `src/pages/watched`, отображает `Card variant='grid'` через `getMoviesByIds`
- Решения: дату просмотра, оценку и прогресс по сериям **не** храним (YAGNI); отдельный слайс, а не расширение favorites — разные сущности, разные события и ключи. Дублирование с favorites осознанно предпочтено абстракции (меньше связности).
- `useFavorites` не трогаем; общий «список id» в `@shared` не выносим.

## Technical Details
- storage: `watchedSlot = createStorageSlot('kinoshka:watched', z.array(z.number()), [])`
- `useWatched()` → `{ ids, isWatched, toggle }` (YAGNI: без `add`/`remove`/`clear`, тип результата не экспортируем — не нужен knip-ignore); `toggle: (id: number) => void` читает `watchedSlot.get()` (не замыкание). Аналитики нет — вне объёма (`trackEvent` не добавляем)
- `useWatchedMovies()` → `use(getMoviesByIds(ids))`
- `MovieActions({ liked, onChange, watched, onWatchedChange })`, `LikedState` без `watched`; a11y: `SecondaryAction` ставит `aria-pressed={active}`, когда `active !== undefined` (все toggle-кнопки единообразно, `Share` — нет)
- **смена дефолта:** сейчас `watched: true` в `Movie.tsx`, после изменения кнопка по умолчанию не нажата
- при `set() === false` (приватный режим/квота) состояние не меняется — это обеспечивает `useStorageSlot`; состояние берётся из хранилища, не из оптимистичного локального
- `Watched` комбинирует `@features/watched`, `@features/favorites`, `@entities/movie` прямо в UI — по образцу `Favorites.tsx`, без `model/`-фасада

## What Goes Where
- **Implementation Steps** — код, тесты, документация в репозитории
- **Post-Completion** — ручная проверка, Lighthouse/Sentry не требуются

## Implementation Steps

### Task 1: Слайс `@features/watched` (хранилище и хуки)
**Model:** sonnet — прямая копия паттерна favorites, тесты подскажут ошибки

**Files:**
- Create: `src/features/watched/index.ts`
- Create: `src/features/watched/model/watchedStorage.ts`
- Create: `src/features/watched/model/useWatched.ts`
- Create: `src/features/watched/model/useWatchedMovies.ts`
- Create: `src/features/watched/model/useWatched.test.ts`
- Create: `src/features/watched/model/useWatchedMovies.test.tsx`

- [x] создать `watchedSlot` (`kinoshka:watched`, zod `z.array(z.number())`, default `[]`)
- [x] реализовать `useWatched` (`ids`, `isWatched`, `toggle`) на `useStorageSlot`
- [x] реализовать `useWatchedMovies` через `use(getMoviesByIds(ids))`
- [x] экспортировать публичный API в `index.ts`
- [x] тесты `useWatched`: toggle туда-обратно, `isWatched`, невалидное значение в storage → `[]`
- [x] тесты `useWatched`: недоступное хранилище (`set()` → `false`) не меняет состояние
- [x] тесты `useWatchedMovies` (MSW, по образцу `useFavoriteMovies.test.tsx`)
- [x] запустить тесты — должны пройти до задачи 2

### Task 2: Переключатель Watched на странице деталей
**Model:** sonnet — точечная правка существующего UI, тесты покрывают

**Files:**
- Modify: `src/pages/movie/ui/types.ts`
- Modify: `src/pages/movie/ui/Movie/Movie.tsx`
- Modify: `src/pages/movie/ui/MovieHero/MovieHero.tsx`
- Modify: `src/pages/movie/ui/MovieActions/MovieActions.tsx`
- Modify: `src/pages/movie/ui/Movie/Movie.test.tsx` (`localStorage.clear()` в `beforeEach`)

- [x] убрать `watched` из `LikedState` и локального `useState` в `Movie.tsx`
- [x] в `Movie.tsx` подключить `useWatched()`; прокинуть `watched` и обработчик через `MovieHero` в `MovieActions`
- [x] `MovieActions({ liked, onChange, watched, onWatchedChange })`; кнопка Watched: `active={watched}`, клик → `toggle(movie.id)`
- [x] `SecondaryAction`: `aria-pressed={active}` при `active !== undefined`
- [x] тест: по умолчанию Watched не нажата (`aria-pressed=false`)
- [x] тест: клик по Watched добавляет id в `kinoshka:watched`, повторный клик удаляет
- [x] тест: состояние сохраняется после перемонтирования страницы
- [x] тест (в `Movie.test.tsx`): остальные кнопки (`Rate`, `Add to list`, `Favorite`) работают как раньше
- [x] запустить тесты — должны пройти до задачи 3

### Task 3: Страница `/watched`
**Model:** sonnet — по образцу `pages/favorites`

**Files:**
- Create: `src/pages/watched/index.tsx`
- Create: `src/pages/watched/WatchedPage.tsx`
- Create: `src/pages/watched/ui/Watched/index.tsx`
- Create: `src/pages/watched/ui/Watched/Watched.module.css`
- Create: `src/pages/watched/ui/Watched/Watched.test.tsx`

- [ ] `Watched` (по образцу `Favorites.tsx`): заголовок «Watched», `EmptyState` при пустом списке («No watched titles yet» + подсказка про кнопку Watched на странице фильма)
- [ ] `AsyncBoundary` со скелетоном, Retry → `getMoviesByIds.invalidate(ids)`, пустой ответ при непустых ids → `EmptyState` «Couldn't load your watched titles»
- [ ] сетка `Card variant='grid'`; избранное на карточках подключить через `useFavorites` как в `Favorites`
- [ ] стили: mobile-first, переносом из `Favorites.module.css`, десктоп-переопределения в `@media (min-width: 720px)`, только токены цветов
- [ ] тесты `Watched.test.tsx`: пустое состояние, список с фикстурой `type: 'tv-series'` (сериал открывается тем же `getMoviesByIds`), скелетон
- [ ] тест Retry — в отдельном `Watched.retry.test.tsx`, как `Favorites.retry.test.tsx`, если нужен свой MSW-сетап
- [ ] запустить тесты — должны пройти до задачи 4

### Task 4: Маршрут, chrome и точка входа
**Model:** sonnet — типовая настройка по `build-budgets.md`, проверки сборки ловят промахи

**Files:**
- Modify: `src/app/router.tsx`
- Modify: `src/app/layouts/AppLayout.tsx`
- Modify: `src/pages/profile/ui/Profile/Profile.tsx`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `src/app/layouts/AppLayout.test.tsx`, `src/app/router.test.tsx`, `src/pages/profile/ui/Profile/Profile.test.tsx`

- [ ] добавить lazy-маршрут `/watched` через `lazyNamed` в `router.tsx`
- [ ] добавить `ROUTE_CHROME['/watched'] = { active: 'lists', title: 'Watched' }` (без `activeNav`; `'lists'` — паритет с `/favorites`, тип `BottomNavKey` его допускает)
- [ ] добавить quick link «Watched» (со счётчиком) на `/profile`
- [ ] добавить в `vite.config.ts` группу `{ name: 'page-watched', test: /\/pages\/watched\// }` после группы `shared`; поправить комментарий «все 8 page-слайсов»
- [ ] `make build-only`, замерить `page-watched`; запись `size-limit` = замер + 15% (не угадывать); перепроверить бюджет `shared` (в него попадёт `@features/watched`); убедиться, что `page-watched` импортирует только runtime/vendor/shared
- [ ] тесты: `AppLayout.test.tsx` (заголовок и подсветка для `/watched`), `router.test.tsx` (навигация на `/watched`), `Profile.test.tsx` (ссылка и счётчик)
- [ ] `make size` — бюджеты проходят
- [ ] запустить тесты — должны пройти до задачи 5

### Task 5: E2E
**Model:** sonnet — по образцу `favorites.spec.ts`

**Files:**
- Create: `e2e/watched.spec.ts`

- [ ] один flow: страница фильма → Watched → `/watched` (карточка есть) → снять Watched → пустое состояние
- [ ] один `checkA11y` на спеку
- [ ] живой API, без моков (fallback при исчерпании квоты — `page.routeFromHAR`)
- [ ] `make e2e` — проходит

### Task 6: Verify acceptance criteria
**Model:** sonnet — сверка результата с планом

- [ ] Watched на странице деталей сохраняется и переживает перезагрузку
- [ ] `/watched` показывает и фильмы, и сериалы; пустое и ошибочное состояния корректны
- [ ] без доступного `localStorage` приложение не падает, Watched не показывает ложное «просмотрено»
- [ ] `make check`, `make test`, `make knip`, `make size`
- [ ] покрытие не хуже текущего стандарта проекта

### Task 7: [Final] Документация
**Model:** sonnet — документация описывает построенное

- [ ] создать `.claude/rules/watched.md` с `paths:` (`src/features/watched/**`, `src/pages/watched/**`, `e2e/watched.spec.ts`): ключ storage, почему отдельный слайс, что не храним
- [ ] добавить строку в таблицу topic docs в `AGENTS.md`, `/watched` — в список маршрутов, `watched` — в список features
- [ ] обновить `profile.md` (новая quick link), `data-layer.md` (список `Keys:` — добавить `kinoshka:watched`), `e2e.md` («all 8 routes» → 9)
- [ ] переместить план в `docs/plans/completed/`

## Post-Completion
*Ручные действия, без чекбоксов*

**Ручная проверка:**
- на мобильном и десктопе: отметить фильм и сериал, проверить `/watched`, перезагрузку, приватный режим браузера
- светлая и тёмная темы на новой странице

**Вне объёма (возможные следующие шаги):**
- дата просмотра, личная оценка, прогресс по сериям
- отметка «просмотрено» прямо на карточках
- синхронизация между устройствами — после появления бэкенда/авторизации
