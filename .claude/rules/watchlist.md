---
paths:
  - 'src/features/watchlist/**'
  - 'src/pages/watchlist/**'
  - 'src/pages/movie/ui/{Movie,MovieActions,MovieHero}/**'
  - 'e2e/watchlist.spec.ts'
---

# Watchlist (`@features/watchlist`, `/watchlist`)

History: `docs/plans/completed/20260929-watchlist.md`.

- **Data:** `kinoshka:watchlist` — массив id через `createStorageSlot`, zod `z.array(z.number())`. Дата добавления и приоритет **не** хранятся (YAGNI). Фильмы и сериалы — один список, как в Watched.
- **Независим от Watched:** нет общего фасада и автоудаления из watchlist при отметке «просмотрено»; фильм может быть в обоих списках — связь двух ключей дала бы скрытую магию без запроса пользователя.
- **`useWatchlist()` → `{ ids, isWatchlisted, toggle }`** — та же форма, что у `useWatched()`; `toggle` читает слот, а не замыкание (два `toggle` в одном тике не затирают друг друга).
- **Единственный писатель — кнопка Watchlist в `MovieActions`** (через `Movie.tsx`/`MovieHero`). Флаги `LikedState` — теперь только `rate`, `fav`; `list` удалён.
- **`/watchlist`** — копия `/watched` (`AsyncBoundary` + `getMoviesByIds`, Retry → `invalidate(ids)`); сердечко на карточке пишет в избранное и карточку не убирает, убрать из списка можно только на странице фильма.
- **Все id 404:** `[]` → `EmptyState` «Watchlist titles unavailable» без Retry — повторять нечего.
- **Квота:** по одному `getMovieDetail` на id, без лимита; демо-тариф API — 200 запросов/день.
- **Chrome:** `ROUTE_CHROME['/watchlist'] = { active: 'lists', title: 'Watchlist' }`, без `activeNav`. В `BottomNav` пункта нет — вход через quick link на `/profile` (со счётчиком).
- **Бюджеты:** группа `page-watchlist` в `vite.config.ts` + запись `size-limit` (1.25 KB); лимит `entry` поднят до 4.05 KB (замер 3.52 kB + запас).
- **Аналитики нет** (`trackEvent` не вызывается).
- **E2E:** `e2e/watchlist.spec.ts` — один flow против живого API (добавить → `/watchlist` → независимость от Watched → убрать → пустое состояние), один `checkA11y`; ссылка из профиля в e2e не проверяется (покрыта unit-тестами).
