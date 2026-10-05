# Кнопка Favorite на странице фильма + проверки избранного

## Overview

- Кнопка «Favorite» на странице фильма (`/movie/:id`) сейчас меняет локальный `useState` и никуда не пишет: фильм не попадает на `/favorites`, состояние теряется при уходе со страницы. Подключаем её к общему избранному (`favoriteIds` / `toggleFavorite` из `@features/favorites`).
- Сердечко на карточках (`Card`) в ветке `reatom` уже работает как в `main` — проверено вручную 2026-10-05 на `localhost:5174` (клик на `/popular` → запись в `kinoshka:favorites` → фильм в гриде `/favorites`, мобильная и десктопная ширина). Кода для него не меняем; он уже покрыт `Favorites.test.tsx`, `Movie.test.tsx` и `e2e/favorites.spec.ts`, добавляем один недостающий тест и e2e-шаги для страницы фильма.
- В `main` кнопка «Favorite» на странице фильма тоже на локальном состоянии, то есть это новая функциональность, а не возврат поведения.

## Context (from discovery)

- Файлы:
  - `src/pages/movie/ui/Movie/Movie.tsx` — держит `liked: { rate, fav }` в `useState`, уже читает `watchedIds` / `watchlistIds`
  - `src/pages/movie/ui/MovieHero/MovieHero.tsx` — пробрасывает `liked` / `onLikedChange` в `MovieActions`
  - `src/pages/movie/ui/MovieActions/MovieActions.tsx` — кнопка `Favorite` на `liked.fav`
  - `src/pages/movie/ui/types.ts` — `LikedState`
  - `src/pages/movie/ui/Movie/Movie.test.tsx` — блок `Movie — Watched` как образец тестов
  - `src/features/favorites/model/favorites.ts` — `favoriteIds`, `toggleFavorite`, `favoriteMovies`
  - `src/pages/favorites/ui/Favorites/Favorites.tsx` и `Favorites.test.tsx`
  - `e2e/favorites.spec.ts` — путь «сердечко на Home → reload → `/favorites`»
- Паттерны: Watched/Watchlist на странице фильма приходят в `MovieHero` → `MovieActions` парой пропсов `watched` / `onWatchedToggle`; `Movie` — `reatomComponent`, читает атомы напрямую.
- Зависимости: `pages/movie` уже импортирует `@features/favorites` (в `RelatedMovies`), новое направление импорта не появляется.

## Development Approach

- **testing approach**: Regular (сначала код, затем тесты)
- каждую задачу завершать полностью до перехода к следующей
- небольшие сфокусированные изменения
- **CRITICAL: каждая задача обязана включать новые/обновлённые тесты** для изменённого кода
- **CRITICAL: все тесты проходят до начала следующей задачи**
- **CRITICAL: обновлять этот файл при изменении объёма работ**
- комментарии в коде — на русском, только WHY

## Testing Strategy

- **unit/component**: Vitest + MSW, `renderMovie()` и хелперы `seedPersisted` / `readPersisted` из существующих тестов; после кликов по `reatomComponent` — `findBy*` / `waitFor`
- **e2e**: Playwright против живого API, квота 200 запросов/день — новый сценарий дописывается в существующий тест `e2e/favorites.spec.ts`, а не отдельным тестом с новым заходом на Home

## Progress Tracking

- отмечать выполненное `[x]` сразу
- новые задачи — с префиксом ➕
- блокеры — с префиксом ⚠️

## Solution Overview

- Избранное на странице фильма передаётся так же, как Watched/Watchlist: `Movie` читает `favoriteIds().has(movie.id)` и передаёт в `MovieHero` → `MovieActions` пару пропсов `favorite` / `onFavoriteToggle`.
- Обработчик — `wrap(() => toggleFavorite(movie.id))`, а не `favoriteIds.toggle`: через `toggleFavorite` уходит аналитическое событие `favorite added`, как у сердечка на карточках. У Watched/Watchlist в `Movie.tsx` обработчики без `wrap` — их в этом плане не трогаем.
- Из `LikedState` убирается поле `fav`; локальным остаётся только `rate` (кнопка «Rate» в этот план не входит).
- Новых атомов, слайсов и rule-файлов не появляется.

## Technical Details

- `MovieActionsProps` и `MovieHeroProps`: добавить `favorite: boolean`, `onFavoriteToggle: () => void`.
- `MovieActions`: `HeartIcon filled={favorite}`, `active={favorite}`, `onClick={onFavoriteToggle}`; подпись кнопки `Favorite` и `aria-pressed` не меняются.
- `LikedState` → `{ rate: boolean }`; начальное значение в `Movie` — `{ rate: false }`.
- Ключ хранилища прежний: `kinoshka:favorites`.

## What Goes Where

- **Implementation Steps** — код, тесты, e2e в этом репозитории
- **Post-Completion** — ручная проверка в браузере

## Implementation Steps

### Task 1: Подключить кнопку Favorite страницы фильма к общему избранному

**Model:** sonnet — изменение расписано, образец (Watched) рядом, тесты покажут результат

**Files:**

- Modify: `src/pages/movie/ui/types.ts`
- Modify: `src/pages/movie/ui/MovieActions/MovieActions.tsx`
- Modify: `src/pages/movie/ui/MovieHero/MovieHero.tsx`
- Modify: `src/pages/movie/ui/Movie/Movie.tsx`
- Modify: `src/pages/movie/ui/Movie/Movie.test.tsx`

- [x] убрать `fav` из `LikedState` в `types.ts`
- [x] в `MovieActions.tsx` добавить пропсы `favorite` / `onFavoriteToggle` и перевести на них кнопку `Favorite`
- [x] в `MovieHero.tsx` добавить те же пропсы и пробросить их в `MovieActions`
- [x] в `Movie.tsx` передать `favorite={favoriteIds().has(movie.id)}` и `onFavoriteToggle={wrap(() => toggleFavorite(movie.id))}`, начальное `liked` — `{ rate: false }`
- [x] над `onFavoriteToggle` в `Movie.tsx` оставить однострочный WHY-комментарий на русском: через `toggleFavorite`, а не `favoriteIds.toggle`, чтобы ушло событие `favorite added`
- [x] добавить в `Movie.test.tsx` блок `Movie — Favorite` по образцу `Movie — Watched`: не нажата по умолчанию; нажата при предустановленном id в `kinoshka:favorites`; клик добавляет id, повторный убирает; состояние переживает перемонтирование
- [x] добавить тест: клик по `Favorite` не меняет `kinoshka:watched` и `kinoshka:watchlist`
- [x] проверить, что существующий тест «остальные кнопки работают независимо от Watched» проходит без правок
- [x] `make test` и `make typecheck` — зелёные до Task 2

### Task 2: Зафиксировать тестами связку «клик → страница избранного»

**Model:** sonnet — только тесты, поведение уже работает

**Files:**

- Modify: `src/pages/favorites/ui/Favorites/Favorites.test.tsx`
- Modify: `e2e/favorites.spec.ts`

- [x] в `Favorites.test.tsx` добавить один тест: страница смонтирована с пустым избранным → `toggleFavorite(1)` → `No favorites yet` исчезает, появляется карточка фильма
  - тест «в избранном один фильм → добавили второй» не добавлять: случай покрыт существующими тестами повторного появления карточки и «не шлёт запросов за уже загруженными фильмами»
- [x] в `e2e/favorites.spec.ts` после финального `checkA11y(page)` существующего теста дописать шаги: на `/favorites` кликнуть ссылку карточки по сохранённому `title` (`page.getByRole('link', { name: title, exact: true }).first()`) → на странице фильма `page.getByRole('button', { name: 'Favorite', exact: true })` имеет `aria-pressed="true"` → клик → `aria-pressed="false"` → `page.goto('/favorites')` → виден `No favorites yet`
  - `exact: true` у кнопки обязателен: без него Playwright матчит подстроку и цепляет «Add to favorites» / «Remove from favorites» на карточках `RelatedMovies`; второй `checkA11y` не добавлять (страница фильма покрыта `movie-detail.spec.ts`); цена шагов — около 2 запросов к API
- [x] `make test` — зелёный
- [x] `make build-only` и `make e2e` (только `favorites.spec.ts`, помнить про квоту) — зелёные до Task 3

### Task 3: Verify acceptance criteria

**Model:** sonnet — сверка результата с планом

- [ ] кнопка `Favorite` на странице фильма добавляет фильм на `/favorites` и убирает его оттуда
- [ ] сердечко на карточках и кнопка на странице фильма показывают одно и то же состояние
- [ ] `make check`
- [ ] `make test`
- [ ] `make knip` — нет неиспользуемых экспортов после правки `LikedState`

### Task 4: [Final] Update documentation

**Model:** haiku — перенос файла, решать нечего

- [ ] rule-файлы и `AGENTS.md` не трогать: неочевидных решений план не добавляет
- [ ] перенести этот план в `docs/plans/completed/`

## Post-Completion

**Ручная проверка:**

- на `/movie/:id` нажать `Favorite`, перейти на `/favorites` — фильм в гриде; вернуться на фильм — кнопка нажата
