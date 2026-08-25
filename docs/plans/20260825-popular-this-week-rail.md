# Popular this week — реальные данные для рейла и страница /popular

## Overview

Пункт 2.3 роадмапа (`plans/roadmap.md:313-319`) — «Popular this week 🔥». Сейчас на главной уже есть блок `PopularMoviesRail`, но он — заглушка: рендерит `useTopRatedMovies()` (обычный топ по рейтингу), а не отдельный курируемый список популярности. Задача — подключить реальный `list`-эндпоинт Kinopoisk API, показать позицию в рейтинге, и добавить полноценную страницу `/popular`.

**Обнаруженный реальный slug — `popular`, а не `top10-week`.** Черновик роадмапа предполагал slug `top10-week` (или «аналогичный — проверь slug в spec»); прямой запрос `GET /v1.5/list/top10-week` возвращает 404. Живой запрос `GET /v1.5/list?slug=top` показал существующий slug `popular` (`GET /v1.5/list/popular` отвечает 200), и его элементы несут `position`/`positionDiff` — то есть само API уже кодирует «место в рейтинге» и «изменение места».

**Ревью плана (`/planning:plan-review`) нашло два критичных факта, которые не были учтены в первой версии, и оба исправлены ниже:**

1. Элементы `/v1.5/list/popular` (`MovieInListDto`) **не содержат `type`/`genres`** — в отличие от `getSearchMovies` (её `SearchMovieDtoV14` эти поля несёт). Это не «тот же компромисс», что в 1.2, а более узкий набор полей. Решение — не пытаться обогатить данные вторым запросом (дороже квоты, лишняя сложность), а сделать `Card`/`MobileCard` устойчивыми к отсутствующему жанру (см. Task 6) и принять, что `typeBadge` для всех элементов popular-списка покажет generic `'movie'` (тот же принцип «accepted default», что уже описан в AGENTS.md для search-эндпоинта).
2. Нижний край `Card` (`variant='compact'`/`'grid'`) **не свободен** — `.actions` (`position:absolute; left:10px; right:10px; bottom:10px; z-index:2`) перекрывает всю нижнюю кромку постера и появляется по `:hover`/`:focus-within`. Rank-бейдж на `Card` должен идти в верхней части (рядом с `.ratingBadge`), а не `bottom/left`. У `MobileCard` нижний край действительно свободен (верхние углы заняты `.rating`/`.favoriteBtn`) — там `bottom-left` остаётся в силе.

## Context (from discovery)

- **Существующий rail-плейсхолдер**: `src/pages/home/ui/PopularMoviesRail/PopularMoviesRail.tsx` — вызывает `useTopRatedMovies()`, рендерит `MovieRailDesktop`. Подключён в `HomeDesktop.tsx` под `AsyncBoundary` с `onRetry={() => invalidateTopRatedMovies()}`.
- **API**: `apiClient.getV15ListBySlug({ path: { slug }, query: { limit, next, prev, withCount } })` (`src/shared/api/instance.gen.ts:314`) → `ListWithMoviesResponseDtoV15 | (401|403|404 error dto)` (`types.gen.ts:1385`, `ListControllerFindOneV15Error`). Успех: `{ name, slug, movies: { docs: MovieListItemWithMovieDto[], limit, next, prev, hasNext, hasPrev }, ... }`. Каждый `docs[]`-элемент — `{ position: number, positionDiff?: number|null, rating?: number|null, votes?: number|null, movie: MovieInListDto }`. `MovieInListDto` (`types.gen.ts:1296`) — `id, name, enName, alternativeName, year, movieLength, poster, rating` — **без `type`/`genres`** (в отличие от `SearchMovieDtoV14`, `types.gen.ts:407`, у которой оба поля есть). Структурно совместимо с `MovieDocLike` в `mapDocToMovie.ts` — недостающие поля просто уйдут в дефолты (`type: 'movie'`, `genre: []`).
- **Ответ на 401/403/404** — отдельный DTO с `statusCode`/`message`, не `docs`. Другие фетчеры (`getMovieDetail.ts:10`) сужают тип через `if ('statusCode' in response.data) throw new ApiError(response.data.message, response.data.statusCode)` — `getPopularMovies` должен делать так же (иначе `make typecheck`/`make build` не пройдёт).
- **Demo-тариф**: `limit ≤ 10`, доступны страницы 1-10 (см. 1.1/1.4 в роадмапе). Список `popular` — курсорный (`next`/`prev`, без `page`), так что «нумерованная пагинация» на `/popular` за рамками разумного при потолке в 10 элементов — страница показывает единственный первый «срез» без пагинации UI.
- **Кэш**: `createCachedFetcher` (`src/entities/movie/api/createCachedFetcher.ts`) — фиксированный `CACHE_TTL_MS = 5 * 60 * 1000` для успешных ответов и `ERROR_CACHE_TTL_MS = 20 * 1000` для cooldown ошибок; не параметризован per-namespace. **Важно**: `createSessionCache` (`src/shared/lib/sessionCache/sessionCache.ts`) персистит в `sessionStorage` только при `import.meta.env.DEV` — в проде 24h TTL работает только как in-memory кэш на время жизни SPA-сессии (переживает ре-рендеры/навигацию, но не reload). Всё равно полезно: снижает число запросов к demo-квоте (200/сутки) при долгой сессии.
- **Rail-виджет**: `MovieRailDesktop` (`src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.tsx`) — типизирован под `items: Movie[]`, рендерит `Card` (`variant='compact'`) в цикле; заголовок рейла — жёстко `<Link to='/search'>` (`MovieRailDesktop.tsx:36`), то есть после появления `/popular` рейл «Popular this week →» продолжит вести на `/search`, если это не исправить отдельно.
- **Card**: `src/entities/movie/ui/Card/Card.tsx`/`Card.module.css` — `.ratingBadge` (top:10,left:10), `.typeBadge` (top:10,right:10), `.actions` (bottom:10, left:10, right:10, `z-index:2`, `opacity:0` → `1` на hover/focus-within). Нижний край занят `.actions`; свободного места на bottom нет.
- **MobileCard**: `src/entities/movie/ui/MobileCard/MobileCard.tsx`/`MobileCard.module.css` — `.rating` (top:8,left:8), `.favoriteBtn` (top:8,right:8). Никакого typeBadge нет вовсе. Нижняя часть постера свободна — туда встаёт rank-бейдж.
- **Иконки** — `src/shared/ui/Icon/Icon.tsx`, инлайн-SVG компоненты. Иконки для «тренда/популярности» ещё нет — нужно добавить.
- **BottomNav** (`src/widgets/mobile-chrome/ui/BottomNav/BottomNav.tsx`) — жёстко зашит на 4 слота (`Home/Catalog/Lists/Profile`), `NavKey = 'home' | 'search' | 'lists' | 'profile'`, `Profile` — заглушка (`path: null`). Сетка — `grid-template-columns: repeat(4, 1fr)` в `BottomNav.module.css`.
- **Header (desktop)** nav — плоский массив `navItems` (`Home + typeNavItems (Movies/Series/Anime) + Favorites`), легко расширяется новым пунктом.
- **Шаблон для новой страницы**: `src/pages/favorites/` — `FavoritesPage.tsx` (`useViewport()` → `FavoritesDesktop`/`FavoritesMobile`), каждый вариант — `AsyncBoundary` + skeleton-грид + `EmptyState` на пустой список. Используется как образец для `/popular`.
- **Роутинг**: `src/app/router.tsx` — плоский список `createBrowserRouter([...])`.

## Development Approach

- **Testing approach**: Regular (сначала код, потом тесты).
- Каждая задача — маленький, самодостаточный шаг; тесты пишутся сразу после кода в той же задаче. Для задач 2 и 11 (где возможны ошибки типов, невидимые для vitest/jsdom) прогонять `make test && make typecheck` перед переходом к следующей задаче — не только `make test`.
- **Порядок задач намеренно ставит расширение `BottomNav`/`NavKey` (Task 8) перед созданием `PopularMobile` (Task 11)** — иначе `<BottomNav active='popular' />` в новом коде не типизируется до Task 8/11 в исходном (неверном) порядке первой версии плана.
- React Compiler мемоизирует сам — не добавлять `useMemo`/`useCallback`.
- Все новые/изменённые компоненты используют `var(--token)` из `global.css`, не хардкодят цвета.
- Импорты — только через публичные `index.ts` слайсов, направление `pages → widgets → features → entities → shared` не нарушается.

## Solution Overview

1. `createCachedFetcher` получает необязательный `options.ttlMs` (по умолчанию — прежние 5 минут, обратная совместимость для всех существующих вызовов).
2. Новый узкий API-враппер `getPopularMovies({ slug, limit })` дёргает `GET /v1.5/list/{slug}`, сужает тип ответа (`ApiError` на 401/403/404), мапит `movies.docs[].movie` → `Movie` через существующий `mapDocToMovie`, и отдельно прокидывает `position`/`positionDiff` в новый тип `PopularMovie`. Кэшируется с `ttlMs: 24h`.
3. `usePopularMovies()` — Suspense-хук поверх `getPopularMovies({ slug: 'popular', limit: 10 })`, с компаньоном `invalidatePopularMovies()` в том же файле хука (конвенция `invalidateTopRatedMovies`/`useTopRatedMovies.ts`) для Retry.
4. Новый переиспользуемый UI-компонент `PopularBadge` (`@entities/movie`) рендерит «#{position}» и — если `positionDiff` присутствует — знаковое числовое изменение (`+2`/`−2`), без интерпретации «вверх/вниз» стрелкой (см. Technical Details — направление `positionDiff` не задокументировано в спеке API и не проверено на исторических данных; кодировать стрелку было бы недоказанным допущением).
5. `Card`/`MobileCard` получают необязательный слот `rankBadge?: ReactNode`, в который его подставляют вызывающие компоненты. Размещение слота **разное для двух компонентов** (см. Overview выше и Task 6): `Card` — сгруппировано с `.ratingBadge` в верхнем левом углу (общий flex-ряд); `MobileCard` — нижний левый угол (свободен).
6. `MovieRailDesktop.items` расширяется до `(Movie | PopularMovie)[]` — это осознанно **отличается** от подхода «Card не знает про PopularMovie» (Card остаётся entity-level и ничего не знает про `PopularMovie`), но `MovieRailDesktop` — виджет уровнем выше в FSD, уже импортирующий `Card`/`Movie` из `@entities/movie`, и может легально знать о `PopularMovie` тоже. `MovieRailDesktop` также получает необязательный `href?: string` (дефолт `'/search'`) для заголовка-ссылки — иначе рейл «Popular this week →» продолжит вести на `/search`.
7. `PopularMoviesRail` переключается с `useTopRatedMovies()` на `usePopularMovies()`, передаёт `href='/popular'`.
8. `BottomNav` расширяется до 5 слотов новым пунктом «Popular» (иконка `TrendingIcon`) — **до** появления страниц, которые на него ссылаются.
9. Новая страница `/popular` (`PopularPage` → `PopularDesktop`/`PopularMobile`) — по образцу `/favorites`: сетка `Card`/`MobileCard` с rank-бейджами, `AsyncBoundary` + skeleton + `EmptyState`.
10. Навигация: `Header` (desktop) получает пункт «Popular»; роут `/popular` добавляется в `router.tsx`.

## Technical Details

- **Новый тип** (`src/entities/movie/model/types.ts`): `PopularMovie = Movie & { position: number; positionDiff?: number | null }`.
- **TTL для popular**: `24 * 60 * 60 * 1000` мс (24 часа) — задаётся в `getPopularMovies.ts`, не глобально. Работает как in-memory кэш SPA-сессии в проде (см. Context про `createSessionCache`/DEV-only персист).
- **Параметры фетчера — явный объект, не `void`**: `createCachedFetcher<{ slug: string; limit: number }, PopularMovie[]>('popularMovies', fetchPopularMovies, { ttlMs: ... })`, вызов — `getPopularMovies({ slug: 'popular', limit: 10 })`. Явные параметры (а не `P = void`) соответствуют конвенции всех остальных фетчеров репозитория (`getMovies`, `getSearchMovies`, `getMoviesPage`, `getMoviesByIds`, `getMovieDetail` — ни один не вызывается без аргументов) и делают истинным утверждение «rail и `/popular`-страница делят один кэш-ключ»: `usePopularMovies()` на обеих поверхностях вызывает `getPopularMovies({ slug: 'popular', limit: 10 })` с одинаковыми параметрами → один и тот же `JSON.stringify(params)`-ключ → одна сетевая загрузка на двоих.
- **Отсутствующие `type`/`genres` в `MovieInListDto`**: намеренно не обогащаются вторым запросом (это удвоило бы расход суточной квоты в 200 запросов на каждое обновление 24h-кэша и добавило бы вторую cache-инвалидацию для синхронизации). `mapDocToMovie` даст `type: 'movie'`, `genre: []` для каждого элемента popular-списка — `typeBadge` покажет generic `'movie'` (тот же «accepted default», что уже описан в AGENTS.md для search-эндпоинта). Единственное реальное визуальное исправление, которое нужно сделать — не рендерить «висящую» точку-разделитель в `.meta`, когда `genre[0]` пуст (см. Task 6 — это общий регрессионный фикс `Card`/`MobileCard`, не специфичный для Popular).
- **Знак `positionDiff` не резолвится в рамках этой задачи** — направление («рост» vs «падение» при положительном значении) не задокументировано в OpenAPI-спеке, а одиночный снапшот API не даёт исторических данных для проверки. `PopularBadge` рендерит `positionDiff` как есть — знаковое число (`+N`/`−N`), без интерпретирующей стрелки/цвета successful/danger (в `global.css` таких токенов и не заведено — только `--accent-warm*`/`--accent-cool`/`--accent-rating`). Если позже семантика уточнится — это отдельная, маленькая последующая задача (добавить стрелку/цвет поверх готового числа).

## What Goes Where

- Implementation Steps (`[ ]`) — весь код, тесты, документация ниже.
- Post-Completion — ручная проверка живых данных API, визуальная проверка новой страницы, уточнение семантики `positionDiff` при появлении исторических данных.

## Implementation Steps

### Task 1: Параметризовать `createCachedFetcher` под кастомный TTL

**Files:**

- Modify: `src/entities/movie/api/createCachedFetcher.ts`
- Modify: `src/entities/movie/api/createCachedFetcher.test.ts`

- [x] Добавить необязательный третий параметр `options?: { ttlMs?: number }` в `createCachedFetcher<P, R>`.
- [x] `isFresh` принимает явный `ttlMs` аргументом вместо чтения захардкоженной константы для успешных записей; `ERROR_CACHE_TTL_MS` для `isError`-записей остаётся неизменным (кулдаун ошибок — не то же самое, что свежесть данных).
- [x] `clearUnfreshCache`, in-memory cache-hit проверка и sessionStorage-snapshot проверка внутри `fetcherFn` используют один и тот же вычисленный `dataTtlMs = options?.ttlMs ?? CACHE_TTL_MS`.
- [x] Без `options` поведение бинарно идентично текущему (дефолт 5 минут) — не трогать существующие вызовы (`getMovies`, `getSearchMovies`, `getMoviesPage`, `getMoviesByIds`, `getMovieDetail`).
- [x] написать тест: кастомный `ttlMs` (например, 24ч) — запись остаётся свежей у порога, устаревает после него (`vi.useFakeTimers()`/`vi.advanceTimersByTime`, как в существующих тестах файла).
- [x] написать тест: без `options` поведение TTL не отличается от текущего (regression-guard).
- [x] run tests — must pass before task 2.

### Task 2: `getPopularMovies` — обёртка над `/v1.5/list/{slug}`

**Files:**

- Create: `src/entities/movie/api/getPopularMovies.ts`
- Create: `src/entities/movie/api/getPopularMovies.test.ts`
- Modify: `src/entities/movie/model/types.ts`

- [x] добавить тип `PopularMovie = Movie & { position: number; positionDiff?: number | null }` в `model/types.ts`.
- [x] `getPopularMovies.ts`: `RequestParams = { slug: string; limit: number }`; `fetchPopularMovies` вызывает `apiClient.getV15ListBySlug({ path: { slug: params.slug }, query: { limit: params.limit } })`.
- [x] сузить тип ответа так же, как `getMovieDetail.ts:10` — `if ('statusCode' in response.data) throw new ApiError(response.data.message, response.data.statusCode)` перед доступом к `response.data.movies`.
- [x] замапить `response.data.movies.docs` в `PopularMovie[]` через `mapDocToMovie(item.movie)` + `{ position: item.position, positionDiff: item.positionDiff }`.
- [x] обернуть в `createCachedFetcher<{ slug: string; limit: number }, PopularMovie[]>('popularMovies', fetchPopularMovies, { ttlMs: 24 * 60 * 60 * 1000 })`.
- [x] написать тест (MSW-хендлер `GET */v1.5/list/:slug`): успешный ответ мапится в `PopularMovie[]` с корректными `position`/`positionDiff`, включая элемент без `type`/`genres` в исходном DTO (проверить дефолты `mapDocToMovie` — `type: 'movie'`, `genre: []`).
- [x] написать тест: пустой список (`movies.docs: []`) → `[]`, не падает.
- [x] написать тест: 403/404-ответ (`statusCode` в теле) → бросает `ApiError` с соответствующим `status` (не падает на попытке прочитать `.movies` из error-DTO).
- [x] run tests && typecheck — must pass before task 3.

### Task 3: `usePopularMovies()` хук + публичный API `@entities/movie`

**Files:**

- Create: `src/entities/movie/hooks/usePopularMovies.ts`
- Create: `src/entities/movie/hooks/usePopularMovies.test.ts`
- Modify: `src/entities/movie/hooks/index.ts`
- Modify: `src/entities/movie/index.ts`

- [x] `usePopularMovies()` — `use(getPopularMovies({ slug: 'popular', limit: 10 }))` внутри Suspense, по образцу `useTopRatedMovies`.
- [x] `invalidatePopularMovies` — companion-инвалидация для Retry, объявлена **в этом же файле** (`usePopularMovies.ts`), с теми же параметрами `{ slug: 'popular', limit: 10 }` — по конвенции `invalidateTopRatedMovies` (живёт рядом с хуком, а не в `api/`-файле).
- [x] реэкспортировать `usePopularMovies`, `invalidatePopularMovies` из `hooks/index.ts`.
- [x] добавить тип `PopularMovie` в экспорт `src/entities/movie/index.ts` рядом с `Movie`/`MovieDetail`.
- [x] написать тест `usePopularMovies.test.ts` (MSW + Suspense-обёртка, по образцу `useTopRatedMovies.test.ts`): хук отдаёт замапленные данные с `position`.
- [x] run tests — must pass before task 4.

### Task 4: `TrendingIcon` — иконка для навигации к «Popular»

**Files:**

- Modify: `src/shared/ui/Icon/Icon.tsx`

- [x] добавить `TrendingIcon` (инлайн SVG, сигнатура как у соседних `Icon`-компонентов — `size`) — растущий график/стрелка вверх, консистентно со стилем существующих иконок (`stroke='currentColor'`, минималистичные пути).
- [x] отдельный тест не требуется (по прецеденту — остальные иконки в `Icon.tsx` не покрыты юнит-тестами индивидуально; косвенно проверяется тестами `BottomNav` в Task 8).
- [x] run tests — must pass before task 5.

### Task 5: `PopularBadge` — UI-компонент позиции и изменения

**Files:**

- Create: `src/entities/movie/ui/PopularBadge/PopularBadge.tsx`
- Create: `src/entities/movie/ui/PopularBadge/PopularBadge.module.css`
- Create: `src/entities/movie/ui/PopularBadge/index.tsx`
- Create: `src/entities/movie/ui/PopularBadge/PopularBadge.test.tsx`
- Modify: `src/entities/movie/index.ts`

- [x] `PopularBadge({ position, positionDiff }: { position: number; positionDiff?: number | null })` — рендерит `#{position}`; если `positionDiff` — ненулевое число, дополнительно рендерит знаковое значение (`+2`/`−2`) без интерпретирующей стрелки/цвета (см. Technical Details — направление не резолвится в этой задаче).
- [x] добавить `aria-label` с текстовым описанием (например, `Позиция 3` или `Позиция 3, изменение +2`), не полагаясь только на визуальные глифы/цвет для передачи смысла.
- [x] стилизация через `var(--...)`-токены (никаких новых hex-цветов — success/danger токенов в `global.css` нет).
- [x] экспортировать `PopularBadge` из `@entities/movie` (`src/entities/movie/index.ts`).
- [x] написать тест: рендерит `#{position}`; с `positionDiff` — видно знаковое число; без `positionDiff`/`0` — знаковое число не рендерится; `aria-label` присутствует и корректен во всех случаях.
- [x] run tests — must pass before task 6.

### Task 6: `Card`/`MobileCard` — слот `rankBadge` для оверлея

**Files:**

- Modify: `src/entities/movie/ui/Card/Card.tsx`
- Modify: `src/entities/movie/ui/Card/Card.module.css`
- Modify: `src/entities/movie/ui/Card/Card.test.tsx`
- Modify: `src/entities/movie/ui/MobileCard/MobileCard.tsx`
- Modify: `src/entities/movie/ui/MobileCard/MobileCard.module.css`
- Modify: `src/entities/movie/ui/MobileCard/MobileCard.test.tsx`

- [x] `Card`/`MobileCard` получают необязательный проп `rankBadge?: ReactNode`, рендерится только когда передан (`undefined` по умолчанию → нулевое изменение для всех существующих вызовов).
- [x] `Card.module.css`: **не** размещать `rankBadge` на `bottom` (там `.actions`, `z-index:2`, перекроет бейдж по hover) — сгруппировать `.ratingBadge` и `rankBadge` в общий flex-ряд в верхнем левом углу (`top:10px; left:10px; display:flex; gap:6px`), сохранив исходный pill-стиль `.ratingBadge`.
- [x] `MobileCard.module.css`: `.rankBadge { position: absolute; bottom: 8px; left: 8px; ... }` — нижний край свободен (верхние углы заняты `.rating`/`.favoriteBtn`), консистентно по паддингам/шрифту с `.rating`.
- [x] regression-фикс (независимо от `rankBadge`, для обоих компонентов): не рендерить `.metaDot`-разделитель, когда `movie.genre[0]` пусто/отсутствует — сейчас при пустом `genre` рендерится висящая точка без текста после неё (актуально для popular-списка, где `genre: []`).
- [x] написать тест: `Card`/`MobileCard` без `rankBadge` — узел бейджа отсутствует в DOM (regression-guard).
- [x] написать тест: `Card`/`MobileCard` с `rankBadge={<span>#1</span>}` — узел рендерится и не перекрыт `.actions` (для `Card` — проверить, что `rankBadge` не имеет тех же координат, что `.actions`, т.е. фактически лежит в верхнем блоке).
- [x] написать тест: `Card`/`MobileCard` с `movie.genre = []` — `.metaDot` не рендерится, нет висящего разделителя.
- [x] run tests — must pass before task 7.

### Task 7: `MovieRailDesktop` — поддержка `PopularMovie[]`, rank-бейджей и кастомного `href`

**Files:**

- Modify: `src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.tsx`
- Modify: `src/widgets/movie-rail/ui/MovieRailDesktop/MovieRailDesktop.test.tsx`

- [x] `items` типизируется как `(Movie | PopularMovie)[]`; при рендере `Card` — `rankBadge={'position' in m ? <PopularBadge position={m.position} positionDiff={m.positionDiff} /> : undefined}`.
- [x] добавить необязательный проп `href?: string` (дефолт `'/search'`), использовать в `<Link to={href}>` вместо захардкоженного `/search`.
- [x] поведение для обычных `Movie[]` и дефолтного `href` (3 существующих рейла) не меняется.
- [x] написать тест: рейл с `PopularMovie[]` рендерит `PopularBadge` внутри карточек; рейл с обычным `Movie[]` — не рендерит.
- [x] написать тест: заголовок рейла со явным `href='/popular'` ведёт на `/popular`; без `href` — на `/search` (regression-guard дефолта).
- [x] run tests — must pass before task 8.

### Task 8: `BottomNav` — 5-й слот «Popular»

**Files:**

- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.tsx`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.module.css`
- Modify: `src/widgets/mobile-chrome/ui/BottomNav/BottomNav.test.tsx`

- [x] расширить `NavKey` до `'home' | 'search' | 'lists' | 'popular' | 'profile'`.
- [x] добавить пункт `{ key: 'popular', label: 'Popular', icon: TrendingIcon, path: '/popular' }` в `items` (после `lists`, перед `profile` — заглушка без назначения остаётся последней).
- [x] `BottomNav.module.css`: `.grid { grid-template-columns: repeat(4, 1fr); }` → `repeat(5, 1fr)`.
- [x] обновить тип `active` в `renderWithProbe` (`BottomNav.test.tsx`) — добавить `'popular'`.
- [x] написать тест: клик по «Popular» ведёт на `/popular`; `active='popular'` подсвечивает пункт активным. Существующий тест на `Profile` (`path: null`, задизейблен) — без изменений по смыслу, проверить, что он всё ещё проходит с 5 колонками.
- [x] run tests — must pass before task 9. **Эта задача должна завершиться раньше Task 11** (страница `PopularMobile` использует `<BottomNav active='popular' />`, что типизируется только после этой задачи).

### Task 9: `PopularMoviesRail` — переключить на реальные данные

**Files:**

- Modify: `src/pages/home/ui/PopularMoviesRail/PopularMoviesRail.tsx`
- Modify: `src/pages/home/ui/HomeDesktop/HomeDesktop.tsx`
- Modify: `src/pages/home/ui/HomeDesktop/HomeDesktop.test.tsx`

- [x] `PopularMoviesRail` вызывает `usePopularMovies()` вместо `useTopRatedMovies()`, передаёт `href='/popular'` в `MovieRailDesktop`.
- [x] `HomeDesktop.tsx`: `onRetry` для рейла `PopularMoviesRail` меняется на `() => invalidatePopularMovies()` (сейчас — `invalidateTopRatedMovies()`, которая после этой задачи используется только `PersonalRails`).
- [x] обновить `HomeDesktop.test.tsx`: тест «PopularMoviesRail и PersonalRails делят один ключ кэша `getMovies`» больше не верен для `PopularMoviesRail` (теперь у него отдельный эндпоинт `/v1.5/list/popular`, не `/v1.5/movie`) — переписать сценарий: `PopularMoviesRail` мокается через отдельный MSW-хендлер `GET */v1.5/list/:slug`, `PersonalRails` остаётся на общем `/v1.5/movie`-моке; проверить, что оба рейла и их independent retry по-прежнему работают корректно по отдельности.
- [x] run tests — must pass before task 10.

### Task 10: Страница `/popular` — `PopularDesktop`

**Files:**

- Create: `src/pages/popular/PopularPage.tsx`
- Create: `src/pages/popular/index.tsx`
- Create: `src/pages/popular/ui/PopularDesktop/PopularDesktop.tsx`
- Create: `src/pages/popular/ui/PopularDesktop/PopularDesktop.module.css`
- Create: `src/pages/popular/ui/PopularDesktop/PopularDesktop.test.tsx`

- [ ] `PopularPage.tsx` — `useViewport()` → `PopularDesktop`/`PopularMobile` (второй появится в Task 11), по образцу `FavoritesPage.tsx`.
- [ ] `PopularDesktop`: `Header activeNav='popular'` + сетка `Card` (`variant='grid'`, `rankBadge={<PopularBadge position={m.position} positionDiff={m.positionDiff} />}`, `isFavorite`/`onToggleFavorite` из `useFavorites()`) внутри `AsyncBoundary` (skeleton-грид + `onRetry={() => invalidatePopularMovies()}`), заголовок страницы, `EmptyState` при пустом списке — структура 1:1 с `FavoritesDesktop.tsx`.
- [ ] написать тест: успешная загрузка рендерит карточки с rank-бейджами; retry реально бьёт в сеть заново (по образцу `FavoritesDesktop.retry.test.tsx`/`HomeDesktop.test.tsx`); пустой список → `EmptyState`.
- [ ] run tests — must pass before task 11.

### Task 11: Страница `/popular` — `PopularMobile`

**Files:**

- Create: `src/pages/popular/ui/PopularMobile/PopularMobile.tsx`
- Create: `src/pages/popular/ui/PopularMobile/PopularMobile.module.css`
- Create: `src/pages/popular/ui/PopularMobile/PopularMobile.test.tsx`
- Modify: `src/pages/popular/PopularPage.tsx`

- [ ] `PopularMobile`: `MobileHeader title='Popular'` + сетка `MobileCard` (`rankBadge`, `isFavorite`/`onToggleFavorite`) внутри `AsyncBoundary`, `BottomNav active='popular'` (типизировано с Task 8) — структура 1:1 с `FavoritesMobile.tsx`.
- [ ] подключить `PopularMobile` в `PopularPage.tsx`.
- [ ] написать тест: аналогично `FavoritesMobile.test.tsx` — успешная загрузка, retry, пустой список.
- [ ] run tests && typecheck — must pass before task 12.

### Task 12: Роутинг и навигация в `Header`

**Files:**

- Modify: `src/app/router.tsx`
- Modify: `src/widgets/header/ui/Header/Header.tsx`
- Modify: `src/widgets/header/ui/Header/Header.test.tsx`

- [ ] добавить роут `{ path: '/popular', element: <PopularPage /> }` в `router.tsx`.
- [ ] `Header.tsx`: добавить пункт `{ key: 'popular', label: 'Popular', path: '/popular' }` в `navItems` (после `favorites`).
- [ ] написать тест в `Header.test.tsx`: клик по «Popular» ведёт на `/popular`; `activeNav='popular'` подсвечивает пункт (по образцу существующих тестов «пункт навигации Favorites»).
- [ ] проверить, что тест `variant='search'` — «содержит только Movies/Series/Anime — без Favorites» (`Header.test.tsx:318`) не задет (он проверяет отдельный под-нав `typeNavItems`, не общий `navItems`).
- [ ] run tests — must pass before task 13.

### Task 13: Verify acceptance criteria

- [ ] `PopularMoviesRail` на главной показывает реальные данные `/v1.5/list/popular` с rank-бейджами (а не `useTopRatedMovies()`).
- [ ] Заголовок рейла «Popular this week →» ведёт на `/popular`, остальные 3 рейла — по-прежнему на `/search`.
- [ ] `/popular` открывается напрямую (deep link) и через навигацию (Header desktop, BottomNav mobile), показывает те же данные, что и rail (один сетевой запрос на оба места при одновременном использовании — общий кэш-ключ).
- [ ] Retry на всех новых async-секциях реально бьёт в сеть заново.
- [ ] `createCachedFetcher` с кастомным `ttlMs=24h` не ломает существующие 5-минутные кэши.
- [ ] Карточки с пустым `genre` (popular-список) не показывают висящую точку-разделитель в meta-строке.
- [ ] `make check` (lint + build) проходит.
- [ ] `make test` — полный набор зелёный.
- [ ] визуально в браузере (`make dev`) проверить: rank-бейдж читаем в light и dark темах, не перекрыт `.actions` при hover на `Card`, `BottomNav` с 5 слотами не переполняется на узких экранах (~360px).

### Task 14: [Final] Обновить документацию

- [ ] обновить `AGENTS.md`: добавить пункт в раздел «Data state» о четвёртой live-data интеграции (`/popular`, slug `popular`, `PopularMovie`, кастомный TTL в `createCachedFetcher`, отсутствие `type`/`genres` у `MovieInListDto` и принятый accepted-default) — по образцу существующих булитов про genre dictionary/search/movie-detail. Явно указать, что 24h TTL в проде — это in-memory кэш на время сессии (persist в sessionStorage — только DEV).
- [ ] отметить пункт 2.3 в `plans/roadmap.md` как выполненный (`- [x]`) по всем его чекбоксам, с уточнением реального slug (`popular`, не `top10-week`) в комментарии рядом.
- [ ] переместить этот файл в `docs/plans/completed/`.

## Post-Completion

**Ручная проверка** (после реализации):

- Собрать исторические данные `positionDiff` за несколько дней (если появится возможность), чтобы окончательно установить знак/направление (рост vs падение) — тогда можно будет добавить интерпретирующую стрелку/цвет поверх `PopularBadge`, не меняя остальной код.
- Прогнать Lighthouse/визуальный проход по `/popular` и обновлённому rail на главной — вне рамок этой задачи (предмет пункта 2.5.6 роадмапа).
- Учитывать суточный лимит demo-тарифа (200 запросов/сутки) при ручном тестировании — каждое обновление `/popular`/rail с истёкшим 24-часовым кэшем расходует один реальный запрос.
