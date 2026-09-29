---
paths:
  - 'src/features/watched/**'
  - 'src/pages/watched/**'
  - 'src/pages/movie/ui/MovieActions/**'
  - 'e2e/watched.spec.ts'
---

# Watched (`@features/watched`, `/watched`)

History: `docs/plans/completed/20260929-watched-list.md`.

- **Data:** `kinoshka:watched` — массив id (порядок = порядок отметки) через `createStorageSlot`, zod `z.array(z.number())`. Дата просмотра, оценка и прогресс по сериям **не** хранятся (YAGNI). Фильмы и сериалы — один список: `MovieType` уже включает сериалы, `getMoviesByIds` отдаёт их тем же endpoint.
- **Отдельный слайс, а не расширение `favorites`:** разные сущности и ключи; дублирование структуры осознанно предпочтено абстракции (меньше связности).
- **`useWatched()` → `{ ids, isWatched, toggle }`.** Без `add`/`remove`/`clear` — вызывающих нет, а неиспользуемый экспорт баррели тянул бы за собой knip-ignore. `toggle` читает `watchedSlot.get()`, а не замыкание (два `toggle` в одном тике не затирают друг друга); при `set() === false` `useStorageSlot` не меняет состояние.
- **Единственный писатель — кнопка Watched в `MovieActions`** (через `Movie.tsx`). Остальные флаги `LikedState` (`rate`, `list`, `fav`) по-прежнему локальный `useState` и не сохраняются. По умолчанию Watched **не нажата** (раньше был `true`).
- **`aria-pressed`** выставляет общий `SecondaryAction` всем toggle-кнопкам (`active !== undefined`); у `Share` его нет.
- **`/watched`** (`Watched.tsx`) — копия `Favorites` (`AsyncBoundary` + `getMoviesByIds`, Retry → `invalidate(ids)`); сердечко на карточке пишет в избранное, карточку из списка не убирает — снять «просмотрено» можно только на странице фильма.
- **Chrome:** `ROUTE_CHROME['/watched'] = { active: 'lists', title: 'Watched' }`, без `activeNav`. В `BottomNav` пункта нет — вход через quick link на `/profile` (со счётчиком).
- **Бюджеты:** группа `page-watched` в `vite.config.ts`; лимит `entry` поднят до 3.6 KB (на `main` он уже был 3502 B — нулевой запас).
- **Аналитики нет** (`trackEvent` не вызывается).
- **E2E:** `e2e/watched.spec.ts` — один flow против живого API (карточка с главной → Watched → `/watched` → снять → пустое состояние), один `checkA11y`.
