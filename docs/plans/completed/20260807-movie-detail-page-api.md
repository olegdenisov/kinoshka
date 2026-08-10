# Детальная страница фильма на реальном API (roadmap 1.5)

## Overview

Страница `/movie/:id` (`src/pages/movie/`) сейчас работает на 100% моке: `id` ищется в `CATALOG` (массив-заглушка из `@entities/movie`), а при промахе молча подставляется `CATALOG[0]` — состояния «не найдено» в приложении не существует вообще (в коде нет ни одного `404`/`NotFound`). Все четыре таба (Overview/Cast/Details/Media) и `MovieHero` читают единственный статичный объект `MOCK_DETAIL`, включая полностью выдуманные поля (`signals.criticalConsensus/audience/pacing/mood/violence/tearRisk`, зашитый текст рекомендации про обсерваторию — не зависящий от того, какой фильм на самом деле открыт).

Пункт 1.5 из `plans/roadmap.md` требует: подключить `instance.getV15MovieById(...)`, убрать `MOCK_DETAIL`, оставить те же 4 таба, но на реальных данных, сделать параллельные запросы через `Promise.allSettled`, добавить skeleton и 404-обработку. Критерий приёмки из раздела Verification того же файла: `/movie/666` → `ErrorState` с retry.

Изучение сгенерированных типов (`src/shared/api/types.gen.ts`) показало, что реальный API не совпадает с формулировкой roadmap «movie + images + similar параллельно»: `similarMovies`/`sequelsAndPrequels` — это поля на самом `MovieDtoV14`, а не отдельный endpoint, как и `persons` (единый источник и для cast, и для crew, различаются по `enProfession`). Отдельный вызов есть только для картинок (`getV15Image`). Поэтому реальная пара для `Promise.allSettled` — `(getMovieDetail, getMovieImages)`; это осознанное отклонение от буквальной формулировки roadmap, а не совпадение с ней, и должно быть явно отражено в финальном чек-листе.

Также обнаружено: `src/shared/api/client.ts` сейчас **отбрасывает HTTP-статус** в interceptor'е (`Promise.reject(new Error(message))`) — без правки туда невозможно надёжно отличить 404 от прочих ошибок.

## Context (from discovery)

- **Файлы/компоненты:** `src/pages/movie/MoviePage.tsx`, `ui/MovieDesktop/`, `ui/MovieMobile.tsx`, `ui/MovieHero/`, `ui/tabs/{OverviewTab,CastTab,DetailsTab,MediaTab}/`, `ui/RelatedMovies/`; `src/entities/movie/model/{types.ts,catalog.ts}`, `src/entities/movie/api/`, `src/entities/movie/hooks/`; `src/shared/api/client.ts`; `src/shared/ui/AsyncBoundary/`.
- **Паттерны, найденные в коде:** живой пример миграции с мока на API уже есть для главной/поиска — `getMovies.ts`, `getSearchMovies.ts`, `getMoviesPage.ts`, все обёрнуты в `createCachedFetcher<P, R>` (TTL 5 мин / error-cooldown 20с / sessionStorage-персист, единый примитив, менять не нужно). Suspense-обвязка: `use()`-вызов должен жить в компоненте-ребёнке `AsyncBoundary`, не в том же компоненте, что рендерит саму границу (см. `SearchDesktop.tsx`/`SearchResults`).
- **Зависимости:** `apiClient.getV15MovieById({ path: { id } })` (без `query`/`selectFields` — всегда полный `MovieDtoV14`, `response.data` напрямую, без `docs`-обёртки); `apiClient.getV15Image({ query: { movieId, type, limit, selectFields } })` для картинок Media-таба — v1.5 image-эндпоинт курсорный (`next`/`prev`/`hasNext`/`hasPrev` вместо `page`/`pages`), но для одноразового `limit: 8` без листания это не имеет значения, используется только `docs`; никакого отдельного эндпоинта для cast/crew/similar-movies не существует — все они уже внутри `MovieDtoV14` (`persons`, `similarMovies`, `sequelsAndPrequels`).

## Development Approach

- **Тестовый подход:** Regular — код, затем тесты в рамках той же задачи (соответствует уже устоявшейся конвенции репозитория: `getMovies.test.ts`/`getSearchMovies.test.ts` пишутся рядом с реализацией, не в TDD-стиле).
- Каждая задача выполняется полностью, прежде чем переходить к следующей; изменения — маленькие и сфокусированные.
- Каждая задача заканчивается новыми/обновлёнными тестами и зелёным `make test`.
- Обновлять этот файл при отклонении от плана; отмечать выполненное `[x]` сразу.

## Testing Strategy

- **Юнит-тесты** обязательны для каждой задачи, где меняется логика (маппер, фильтрация cast/crew, `useMovieDetail`, `ApiError`).
- **Интеграционные тесты** — через MSW (`msw/node`, уже настроен в `src/test/setup.ts`, `onUnhandledRequest: 'error'`), по образцу `SearchDesktop.test.tsx`/`getSearchMovies.test.ts`.
- **E2E** — в проекте пока нет Playwright (появится в фазе 2.5 roadmap) — не в рамках этой задачи.

## Progress Tracking

- Отмечать `[x]` сразу по завершении.
- Новые задачи — с префиксом ➕, блокеры — с префиксом ⚠️.
- По завершении — перенести этот файл в `docs/plans/completed/`.

## Solution Overview

- Новый доменный тип `MovieDetail` строится из реальных полей `MovieDtoV14`, а не переиспользует старую мок-форму. Полностью выдуманный блок `signals` и hardcoded-рекомендация «Why it's for you» удаляются без замены суррогатом — заменяются реальными данными (страны, рейтинги KP/IMDb/MPAA) в том же UI-слоте, где это уместно.
- `cast`/`crew` — не отдельные API-сущности, а один и тот же `persons: PersonInMovie[]`, отфильтрованный по `enProfession` (whitelist `{director,writer,producer,composer,operator}` → crew, `'actor'` → cast). Строгого enum на этом поле у Kinopoisk нет — список профессий для crew стоит уточнить на реальном ответе API в Task 2 и при необходимости скорректировать.
- Композиция `Promise.allSettled` живёт в `src/entities/movie/hooks/useMovieDetail.ts` — **не** в page-слое (`src/pages/movie/model/`), потому что оба вызова относятся к одной и той же сущности `@entities/movie`; правило AGENTS.md про page-facade применимо только когда нужно объединять данные из разных нижестоящих слайсов (как `useMovieCatalog` объединяет `@features/catalog-filter` + `@entities/movie`), здесь это условие не выполняется. При частичном отказе (картинки упали, фильм — нет) хук отдаёт `images: []`, страница не падает целиком; при отказе самого фильма (включая 404) ошибка всплывает и гасит Suspense-границу.
- 404 определяется через новый `ApiError extends Error { status?: number }`, выбрасываемый из `client.ts`-interceptor'а вместо голого `Error` (обратно совместимо — все текущие `.message`-проверки в тестах продолжают работать). `AsyncBoundary` получает новый опциональный проп `errorFallback` (по умолчанию — текущее поведение, все прочие вызовы `AsyncBoundary` не меняются) — `MoviePage` через него рендерит отдельный `ErrorState` для 404 и общий для прочих ошибок, оба — с рабочим `onRetry`.
- Нечисловой `:id` (`/movie/abc`) отсекается ДО сетевого запроса — `Number.isNaN`-проверка в `MoviePage` рендерит not-found без `AsyncBoundary`/`Suspense` и без вызова API.
- Zod на этой границе намеренно не вводится — ни `getMovies.ts`, ни `getSearchMovies.ts`, ни `getMoviesPage.ts` не валидируют API-ответы через Zod (только доверяют сгенерированным типам); Zod в проекте зарезервирован для localStorage/sessionStorage-границ.

## Technical Details

**Новый `MovieDetail` (`src/entities/movie/model/types.ts`):**

```ts
type CastMember = { id: number; name: string; role: string; photo?: string }
type CrewMember = { id: number; name: string; profession: string }

type MovieDetail = Movie & {
  tagline: string
  synopsis: string
  shortSynopsis?: string
  backdrop?: string
  trailerUrl?: string
  cast: CastMember[]
  crew: CrewMember[]
  countries: string[]
  ratingKp?: number
  ratingImdb?: number
  votesKp?: string
  criticScore?: number // rating.filmCritics
  criticReviewCount?: number // votes.filmCritics
  ageRating?: number
  ratingMpaa?: string
  budget?: { value: number; currency: string }
  feesWorld?: { value: number; currency: string }
  premiereWorld?: string
  similarMovies: Movie[]
}
```

**Новые файлы `src/entities/movie/api/`:**

- `mapDtoToMovieDetail.ts` — чистая функция `MovieDtoV14 → MovieDetail` (по образцу `mapDocToMovie.ts`), с fallback-цепочками полей и выделенными `isCast`/`isCrew`.
- `getMovieDetail.ts` — `createCachedFetcher<number, MovieDetail>('movie-detail', fetchMovieDetail)`.
- `getMovieImages.ts` — `createCachedFetcher<number, MovieImage[]>('movie-images', fetchMovieImages)`, `MovieImage = { url: string; previewUrl?: string }`, запрос с `limit: 8` (демо-тариф: `limit ≤ 10`).

**`src/entities/movie/hooks/useMovieDetail.ts`:**

```ts
const useMovieDetail = (
  id: number,
): { detail: MovieDetail; images: MovieImage[] } => {
  // Promise.allSettled([getMovieDetail(id), getMovieImages(id)])
  // detail rejected → пробросить ошибку дальше (включая 404)
  // images rejected → images: []
  // связка держится в module-level Map<number, Promise<...>> для стабильной ссылки под use()
}
```

**`client.ts`:**

```ts
export class ApiError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}
// interceptor: Promise.reject(new ApiError(message, error.response?.status))
```

## What Goes Where

- **Implementation Steps** (`[ ]`): все задачи ниже — код в рамках репозитория.
- **Post-Completion**: ручная проверка в браузере (401/404/network-offline сценарии, визуальная проверка skeleton).

## Implementation Steps

### Task 1: `ApiError` и сохранение HTTP-статуса

**Files:**

- Modify: `src/shared/api/client.ts`
- Modify: `src/shared/api/index.ts`

- [x] добавить `export class ApiError extends Error { status?: number }` в `client.ts`
- [x] в interceptor'е `Promise.reject(new Error(message))` → `Promise.reject(new ApiError(message, error.response?.status))`
- [x] экспортировать `ApiError` из `src/shared/api/index.ts`
- [x] прогнать существующие `getSearchMovies.test.ts`/`getMoviesPage.test.ts` (403-cooldown кейсы) — должны остаться зелёными без изменений
- [x] написать тест: мокнутый 404/403-ответ через MSW → `ApiError.status` выставлен корректно
- [x] запустить тесты — должны пройти перед задачей 2

### Task 2: Домен-типы `MovieDetail`/`CastMember`/`CrewMember` + маппер

**Files:**

- Modify: `src/entities/movie/model/types.ts`
- Create: `src/entities/movie/api/mapDtoToMovieDetail.ts`
- Create: `src/entities/movie/api/mapDtoToMovieDetail.test.ts`

- [x] переписать `MovieDetail` в `types.ts` по схеме из раздела Technical Details (убрать `signals`, старую форму `cast`/`details`)
- [x] `CastMember = { id, name, role, photo? }` (`name` — реальное имя актёра, `role` — персонаж/`description`, местами наоборот относительно старого мока), `CrewMember = { id, name, profession }`
- [x] написать `mapDtoToMovieDetail(dto: MovieDtoV14): MovieDetail` — с fallback-цепочками (`title`, `synopsis`) и пустыми массивами при отсутствии `persons`/`genres`/`countries`
- [x] выделить `isCast`/`isCrew` (фильтр по `enProfession`) как отдельно тестируемые функции
- [x] написать тесты маппера: полный DTO → полный `MovieDetail`; отсутствующие опциональные поля → корректные fallback'и; персона с неизвестным `enProfession` → не попадает ни в cast, ни в crew
- [x] запустить `make typecheck` — ожидаемо покажет fallout по старым потребителям `MOCK_DETAIL`/старого типа `MovieDetail` (список пригодится для Task 4/8/9)
- [x] запустить тесты — должны пройти перед задачей 3

### Task 3: Фетчеры `getMovieDetail`/`getMovieImages`

**Files:**

- Create: `src/entities/movie/api/getMovieDetail.ts`
- Create: `src/entities/movie/api/getMovieDetail.test.ts`
- Create: `src/entities/movie/api/getMovieImages.ts`
- Create: `src/entities/movie/api/getMovieImages.test.ts`

- [x] `getMovieDetail = createCachedFetcher<number, MovieDetail>('movie-detail', fetchMovieDetail)`, `fetchMovieDetail` вызывает `apiClient.getV15MovieById({ path: { id } })` и прогоняет `response.data` через `mapDtoToMovieDetail`
- [x] `getMovieImages = createCachedFetcher<number, MovieImage[]>('movie-images', fetchMovieImages)`, вызывает `apiClient.getV15Image({ query: { movieId: [String(id)], type: ['frame','screenshot'], limit: 8, selectFields: ['url','previewUrl'] } })`
- [x] `MovieImage = { url: string; previewUrl?: string }`, отфильтровать записи с пустым `url`
- [x] написать тесты через MSW (по образцу `getSearchMovies.test.ts`): success-path для обоих фетчеров
- [x] написать тест 404-path для `getMovieDetail` — проверить `error instanceof ApiError && error.status === 404`
- [x] написать тест 403-cooldown path (регресс на `createCachedFetcher`) и пустой `docs` → `[]` для картинок
- [x] запустить тесты — должны пройти перед задачей 4

### Task 4: Композиция `useMovieDetail` + чистка публичного API

**Files:**

- Create: `src/entities/movie/hooks/useMovieDetail.ts`
- Create: `src/entities/movie/hooks/useMovieDetail.test.tsx`
- Modify: `src/entities/movie/hooks/index.ts`
- Modify: `src/entities/movie/index.ts`
- Modify: `src/entities/movie/model/catalog.ts`

- [x] реализовать `useMovieDetail(id)` — `Promise.allSettled([getMovieDetail(id), getMovieImages(id)])`; `detail` rejected → пробросить ошибку; `images` rejected → `images: []`
- [x] держать промис связки в module-level кеше (стабильная ссылка под `use()`) — ⚠️ отклонение от буквального плана: не `Map<number, Promise<...>>` с ручным TTL/cooldown (как `pageCache` в `getMoviesPage.ts`), а `WeakMap<Promise<MovieDetail>, WeakMap<Promise<MovieImage[]>, Promise<MovieDetailBundle>>>`, ключ — сами уже-закешированные внутренние промисы `getMovieDetail(id)`/`getMovieImages(id)`. История ревизий: (1) без всякого кеша, полагаясь на React Compiler — не сработало, `use(combineDetail(id))` создаёт новый промис на каждый вызов, "suspended by an uncached promise" в цикле на 404-тесте; (2) `useMemo(() => combineDetail(id), [id])` — тоже не сработало (тот же баг): React не сохраняет hook-memo между суспендом до первого коммита и ретраем, инициализатор `useMemo` перезапускается заново на каждый ретрай; (3) `Map<number, {promise, timestamp, isError}>` с ручным `ERROR_CACHE_TTL_MS` cooldown — заработало, но получилась дублирующая копия TTL/cooldown-логики поверх уже закешированных `getMovieDetail`/`getMovieImages`, и (уже найденный баг) успешные записи никогда не устаревали и кеш не сбрасывался в `resetAllCachedFetchers`. По второму мнению (codex, gpt-5.5, xhigh) — финальный вариант (4): `WeakMap`, ключ — сами внутренние промисы. Стабильность автоматически наследуется от `createCachedFetcher`: пока внутренний промис не поменял ссылку (жив в своём TTL/cooldown), связка стабильна; как только он инвалидируется — `WeakMap`-запись естественно "устаревает" сама, без ручного TTL и без impact на `resetAllCachedFetchers`
- [x] экспортировать `useMovieDetail` из `hooks/index.ts` → `@entities/movie`
- [x] удалить `MOCK_DETAIL` из `catalog.ts` и из `entities/movie/index.ts` (оставить `CATALOG`/`ALL_GENRES` — `CATALOG` всё ещё используется в `HomeMobile`, вне рамок 1.5)
- [x] написать тесты `useMovieDetail` (RTL + MSW): оба успешны; фильм успешен + картинки падают → `images: []` без throw; фильм падает (404) → промис реджектится
- [x] запустить тесты — должны пройти перед задачей 5

### Task 5: `AsyncBoundary.errorFallback`

**Files:**

- Modify: `src/shared/ui/AsyncBoundary/AsyncBoundary.tsx`
- Create: `src/shared/ui/AsyncBoundary/AsyncBoundary.test.tsx` (если такого теста ещё нет)

- [x] добавить опциональный проп `errorFallback?: (params: { error: Error | null; reset: () => void }) => ReactNode`, по умолчанию — текущее поведение
- [x] проверить существующие вызовы (`SearchDesktop`, home rails) — не должны измениться ни в поведении, ни в тестах
- [x] написать тест: рендер с кастомным `errorFallback` показывает его вместо дефолтного `ErrorState`
- [x] запустить тесты — должны пройти перед задачей 6

### Task 6: Переписать `MoviePage.tsx`

**Files:**

- Modify: `src/pages/movie/MoviePage.tsx`

- [x] убрать `CATALOG.find(...) ?? CATALOG[0]` полностью
- [x] `numericId = Number(id)`; если `!id || Number.isNaN(numericId)` — рендерить not-found `ErrorState` сразу, без `AsyncBoundary`/сетевого запроса
- [x] добавить внутренний компонент `MovieDetailContent({ id, isMobile })`, вызывающий `useMovieDetail(id)` и рендерящий `MovieMobile`/`MovieDesktop` с `movie`+`images`
- [x] обернуть в один `AsyncBoundary` с `errorFallback`, различающим `error instanceof ApiError && error.status === 404` (текст «Movie not found») от прочих ошибок (общий текст) — оба варианта с `onRetry={reset}`
- [x] временный простой `fallback` — не передаём явно, используется дефолтный `<Spinner />` из `AsyncBoundary` (заменится в Task 7)
- [x] по пути поправлен pre-existing огрех: `useViewport` импортировался в обход публичного API слайса (`'../../shared/lib/viewport/useViewport'` вместо `@shared/lib`) — переведено на алиас
- [x] запустить `make typecheck` — ⚠️ 2 новые ожидаемые ошибки (в дополнение к уже известным 7 из Task 4): `MovieDetailContent` передаёт `images` в `<MovieMobile>`/`<MovieDesktop>`, а `MovieMobileProps`/`MovieDesktopProps` пока объявляют только `movie` — их прото́типы обновятся в Task 8/9 (единственных задачах, которые трогают эти файлы; `MoviePage.tsx` в их списке файлов нет, поэтому проброс `images` пришлось делать здесь). Итого 9 известных ошибок, все — ожидаемый fallout, закроются к концу Task 9. `make test` — 302/302 зелёных, `eslint` — чисто

### Task 7: `MovieDetailSkeleton`

**Files:**

- Create: `src/pages/movie/ui/MovieDetailSkeleton/MovieDetailSkeleton.tsx`
- Create: `src/pages/movie/ui/MovieDetailSkeleton/MovieDetailSkeleton.module.css`
- Create: `src/pages/movie/ui/MovieDetailSkeleton/index.tsx`
- Modify: `src/pages/movie/MoviePage.tsx`

- [x] собрать из примитива `Skeleton` (по образцу `MovieRailSkeletonDesktop`/`SearchResultSkeletonGrid`): hero-блок (постер + заголовок + 3 рейтинг-блока + абзац синопсиса), полоска табов (4 pill-скелетона), контент-область (2-колоночная сетка текстовых линий)
- [x] один вариант на оба device-типа (не под `isMobile` отдельно)
- [x] подключить в `MoviePage.tsx` как `fallback` вместо временного placeholder'а из Task 6
- [x] визуальная smoke-проверка — ⚠️ отклонение: полноценная проверка в браузере (`/movie/:id`) сейчас невозможна — страница падает на этапе загрузки модуля («does not provide an export named 'MOCK_DETAIL'»), т.к. `MovieHero`/`MovieMobile`/`CastTab`/`DetailsTab`/`OverviewTab` всё ещё импортируют `MOCK_DETAIL` (fallout Task 4, закроется в Task 8/9). Проверено то, что можно проверить сейчас: `MovieDetailSkeleton` рендерится без ошибок изолированно (RTL, временный smoke-тест, не закоммичен — по прецеденту `MovieRailSkeletonDesktop` без выделенного теста); полноценный визуальный проход по `/movie/:id` (dev-сервер + Chromium-скриншот) — перенесён на Post-Completion / после Task 9

### Task 8: Перевести desktop-компоненты на реальные данные

**Files:**

- Modify: `src/pages/movie/ui/MovieDesktop/MovieDesktop.tsx`
- Modify: `src/pages/movie/ui/MovieHero/MovieHero.tsx`
- Modify: `src/pages/movie/ui/tabs/OverviewTab/OverviewTab.tsx`
- Modify: `src/pages/movie/ui/tabs/CastTab/CastTab.tsx`
- Modify: `src/pages/movie/ui/tabs/DetailsTab/DetailsTab.tsx`
- Modify: `src/pages/movie/ui/tabs/MediaTab/MediaTab.tsx`
- Modify: `src/pages/movie/ui/RelatedMovies/RelatedMovies.tsx`
- Create: `src/entities/movie/lib/formatCurrency.ts`
- Create: `src/pages/movie/ui/MovieDesktop/MovieDesktop.test.tsx`

- [x] `MovieDesktop`/все табы: проп `movie: Movie` → `movie: MovieDetail`; убрать `import { MOCK_DETAIL }`; `MediaTab` дополнительно получает `images: MovieImage[]`
- [x] `MovieHero`: `tagline`/`synopsis` — из `movie`; блок рейтингов — `votesKp ?? '—'`, `criticScore != null ? \`${criticScore.toFixed(0)}%\` : '—'`; кнопка трейлера видима/активна только если `movie.trailerUrl`задан — ➕ synopsis-тизер в Hero берёт`movie.shortSynopsis ?? movie.synopsis`(эквивалент старого`.split('\n')[0]`, но через специально предназначенное для этого поле типа вместо магии на строке); кнопка трейлера — теперь `<a href target="_blank" rel="noreferrer">`, а не голый `<button>`
- [x] `OverviewTab`: `crew` — маппинг переменной длины (`movie.crew.map(c => <MetaRow label={c.profession} value={c.name} />)`); блок `signals` и «Why it's for you» удалить целиком; заменить на блок «Страны»/«Рейтинги» (`countries.join(' · ')`, KP/IMDb/MPAA)
- [x] `CastTab`: принимает `cast: CastMember[]`; `c.role`/`c.name` вместо старых `name`/`actor`; если `c.photo` есть — рендерить `<img>`, иначе оставить hue-градиент как fallback — ⚠️ отклонение: `CastMember` (в отличие от старого мок-cast) не несёт `hue`, взят фиксированный `FALLBACK_HUE = 220` по прецеденту статичного фолбэка в `Poster.tsx` (`movie.hue ?? 20`), не id-хэш
- [x] `DetailsTab`: `Release date` ← `premiereWorld`, `Country` ← `countries.join(' · ')`, убрать `Language`/`Aspect ratio`/`Sound mix`, добавить `MPAA rating` (`ratingMpaa`) и `Age rating` (`ageRating`, формат `"16+"`), `Budget`/`Box office` — через новый `formatCurrency`, `'—'` при отсутствии поля
- [x] `MediaTab`: скриншоты — `images.length > 0 ? images.map(...) : <текущий градиентный fallback>`; кнопка трейлера открывает `movie.trailerUrl` в новой вкладке, если задан (иначе — задизейбленная `<button disabled>`)
- [x] `RelatedMovies`: сигнатура не меняется; вызов в `MovieDesktop` — `movie.similarMovies.slice(0, 6)` вместо `CATALOG.filter(...)`; секция скрывается целиком, если `similarMovies` пуст (`return null`, если `movies.length === 0`, внутри самого компонента)
- [x] написать компонентный RTL-тест `MovieDesktop` на вручную собранном фикстур-объекте `MovieDetail` (без MSW) — ключевые поля видны в каждом табе (7 тестов: Overview×2, Cast, Media, Details, RelatedMovies×2)
- [x] запустить тесты — должны пройти перед задачей 9. `make test` — 311/311, `eslint .` по всему проекту — чисто, `tsc` — 3 известные ошибки, все в `MovieMobile.tsx`/`MoviePage.tsx` (Task 9 scope); весь desktop-fallout из Task 4 закрыт

### Task 9: Перевести `MovieMobile.tsx` на реальные данные

**Files:**

- Modify: `src/pages/movie/ui/MovieMobile.tsx`
- Create: `src/pages/movie/ui/MovieMobile.test.tsx`

- [x] применить те же изменения полей, что в Task 8, к 4 инлайновым саб-компонентам (`MobileOverview`↔`OverviewTab`, `MobileCast`↔`CastTab`, `MobileMedia`↔`MediaTab`, `MobileDetailsContent`↔`DetailsTab`) — не переводить файл на CSS-модули, только источник данных
- [x] проп `movie: MovieDetail` + новый `images: MovieImage[]` в `MovieMobileProps`
- [x] `related` — `movie.similarMovies.slice(0, 6)` вместо `CATALOG.filter(...)`
- [x] написать компонентный RTL-тест `MovieMobile` на той же фикстуре, что в Task 8
- [x] запустить тесты — должны пройти перед задачей 10. `make test` — 318/318 зелёных, `make lint` — чисто, `make typecheck` — чисто (весь fallout Task 4 закрыт)

### Task 10: Интеграционные тесты `MoviePage`

**Files:**

- Create: `src/pages/movie/MoviePage.test.tsx`

- [x] `/movie/1` happy path: сперва skeleton, затем реальные данные после резолва MSW (заголовок, cast, переключение табов) — ⚠️ отклонение: разбито на 2 отдельных теста вместо одного (`показывает MovieDetailSkeleton, а не реальные данные` / `показывает реальные данные после резолва MSW, табы переключаются`), а не единый сценарий "skeleton → data" внутри одного `it`. Причина — экспериментально найденный React 19 act()-гоча: рендер, начатый вне `await act(async () => ...)`, а затем резолвнутый вне того же act-скоупа, оставляет обновление незафлашенным в jsdom (React выводит предупреждение "A suspended resource finished loading inside a test, but the event was not wrapped in act(...)" и DOM реально не обновляется, зависая на fallback бесконечно — воспроизведено через временный debug-тест). Рабочий паттерн, уже принятый в репо (`useMovieDetail.test.tsx`): весь цикл рендер+резолв — внутри одного `await act(async () => { render(...) })`. Поэтому skeleton-состояние проверяется отдельным тестом с намеренно бесконечно pending MSW-хендлером (`() => new Promise(() => {})`), а resolved-состояние — через `renderMoviePage()` (единый `await act(async () => ...)`, по образцу `useMovieDetail.test.tsx`)
- [x] `/movie/666` с MSW-мокнутым 404 → рендерится `ErrorState` с текстом not-found и рабочей кнопкой retry (клик → повторный запрос через MSW call-capture, по образцу `getSearchMovies.test.ts`) — использован `vi.useFakeTimers()` + `advanceTimersByTime(21_000)` перед кликом, чтобы обойти `ERROR_CACHE_TTL_MS` (20с) cooldown в `createCachedFetcher` и получить реальный повторный сетевой запрос, а не cache-hit на том же реджекнутом промисе
- [x] `/movie/abc` (нечисловой id) → not-found без единого зарегистрированного MSW-хендлера, полагаясь на `onUnhandledRequest: 'error'`
- [x] общая ошибка (500/network error) → рендерится общий `ErrorState`, текстово отличимый от not-found-варианта
- [x] переключение табов (Overview/Cast/Details/Media) после загрузки — каждый таб показывает реальные данные
- [x] это финальный гейт, напрямую проверяющий критерий приёмки roadmap («`/movie/666` → ErrorState с retry»)
- [x] запустить полный набор тестов — должны пройти перед задачей 11. `make test` — 323/323 зелёных, `make lint` — чисто, `make typecheck` — чисто

### Task 11: Проверка acceptance criteria

- [x] проверить, что все требования из Overview реализованы (`getV15MovieById` подключён, `MOCK_DETAIL` удалён, 4 таба на реальных данных, `Promise.allSettled` для movie+images, skeleton, 404-обработка) — подтверждено чтением кода: `getMovieDetail.ts` вызывает `apiClient.getV15MovieById`, `grep -rn MOCK_DETAIL src` — пусто, `useMovieDetail.ts` использует `Promise.allSettled`, `MoviePage.tsx` рендерит `MovieDetailSkeleton` как `fallback` и `errorFallback` с веткой `ApiError.status === 404`
- [x] проверить edge cases: нечисловой id, отказ только images, отказ movie (404), отказ movie (500/network) — все 4 сценария покрыты тестами (`MoviePage.test.tsx`: `/movie/abc` без сетевых запросов, `/movie/666` → 404 + retry, `/movie/777` → 500 → общий `ErrorState`; `useMovieDetail.test.tsx`: images-500 → `images: []` без throw)
- [x] запустить полный набор тестов: `make test` — 323/323 зелёных
- [x] запустить `make lint && make typecheck && make build` — все три прошли без ошибок
- [x] проверить покрытие тестами соответствует уровню остальных API-обёрток (`getSearchMovies`/`getMoviesPage`) — coverage-прогон: `getMovieDetail.ts` 83.33%/`getMovieImages.ts` 87.5% (тот же профиль непокрытой type-narrowing ветки, что у уже принятого `getMovies.ts` — 83.33%, идентичный паттерн), `mapDtoToMovieDetail.ts` 100%, `MoviePage.tsx` 93.33%, `MovieDesktop.tsx`/`MovieMobile.tsx` ~83-84% — на уровне или выше `getMoviesPage.ts` (97.56%); суммарно 881 строк тестов по 8 файлам для movie-detail vs 531 строк по 2 файлам для search-фетчеров — покрытие шире по слоям (fetcher/mapper/hook/page/components), не только по фетчерам

### Task 12: Обновление документации

- [x] отметить выполненные пункты 1.5 в `plans/roadmap.md`
- [x] обновить `AGENTS.md` — `ApiError`/`AsyncBoundary.errorFallback` задокументирован как переиспользуемый паттерн для будущих 404-страниц; строка про `MOCK_DETAIL`/movie-detail в "Still mock data" переехала в "Also live-data" (уже неактуальна была указана как мок)
- [x] manual test (skipped - not automatable): перенести этот файл в `docs/plans/completed/` — по правилу раннера плановые файлы не перемещаются агентом; перенос выполняется harness'ом по завершении всех фаз

## Post-Completion

**Ручная проверка** (после Task 12):

- в браузере: `/` → карточка → переход на `/movie/:id` показывает реальные постер/название/рейтинг/синопсис/каст/детали, без обращений к `MOCK_DETAIL`/`CATALOG` (`grep -r MOCK_DETAIL src` — должно быть пусто)
- `/movie/666` (несуществующий id) → `ErrorState` с текстом «не найдено» и работающей кнопкой Retry
- `/movie/abc` → тот же not-found-путь, но без единого сетевого запроса (проверяется в DevTools Network)
- временное отключение картинок (throttling/блокировка домена в DevTools) при рабочем основном запросе → страница фильма всё равно рендерится, Media-таб показывает fallback-плейсхолдеры
