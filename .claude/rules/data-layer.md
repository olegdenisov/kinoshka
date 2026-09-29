---
paths:
  - 'src/entities/movie/**'
  - 'src/entities/person/**'
  - 'src/pages/person/**'
  - 'src/shared/api/**'
  - 'src/shared/lib/storage/**'
  - 'src/shared/lib/sessionCache/**'
  - 'src/shared/lib/cachedFetcher/**'
  - 'src/shared/ui/AsyncBoundary/**'
  - 'src/shared/ui/ErrorBoundary/**'
  - 'src/shared/ui/ErrorState/**'
  - 'src/pages/search/**'
  - 'src/pages/movie/**'
  - 'src/pages/popular/**'
  - 'src/pages/recommendations/**'
  - 'src/pages/favorites/**'
  - 'src/pages/home/**'
  - 'src/features/catalog-filter/**'
  - 'src/features/favorites/**'
  - 'src/features/recommendations/**'
  - 'src/widgets/header/**'
---

# Data layer

History: `docs/plans/completed/20260805-search-filters-url-sync.md`, `…-movie-detail-page-api.md`, `…-async-boundary-retry-and-empty-states.md`, `…-dynamic-genre-dictionary.md`, `…-favorites-feature.md`, `…-popular-this-week-rail.md`, `…-recommendations-rule-based.md`, `…-person-detail-page.md`.

## Shared building blocks

- **`createCachedFetcher<P, R>(namespace, fetcher, options?)`** (`@shared/lib`) — TTL cache (default 5 min, `options.ttlMs` to override), session-persist, 403 cooldown, error cache (`ERROR_CACHE_TTL_MS` = 20s). Returns a fetcher with `invalidate(params)`/`clear()`. Moved out of `@entities/movie` because `@entities/person` needed it too and entity slices can't import each other. Use it for every new fetcher.
- `createSessionCache` persists to `sessionStorage` **only in `import.meta.env.DEV`**; in prod the cache is in-memory for the SPA session (lost on reload).
- **`AsyncBoundary`** (`@shared/ui`): Suspense + error boundary. Optional `errorFallback({ error, reset })` and `onRetry()` (runs before `reset()`). Every retry-capable boundary wires `onRetry` to an `invalidate*` export next to its hook (`invalidateTopRatedMovies`, `invalidateNewMovies`, `invalidateMovieCatalog`, `invalidateMovieDetail`, `invalidateRecommendations`, `invalidatePersonDetail`) — otherwise Retry replays the cached rejection for 20s. Double-click protection is the synchronous `isRetryingRef`, reset on every `errorFallback` render — **not** an error-reference comparison (fetchers replay the same `Error` object). A per-route `ErrorBoundary` sits above every page's `AsyncBoundary` (`AppLayout.tsx`, `docs/plans/completed/20260916-per-route-error-boundaries.md`), but `AsyncBoundary` itself doesn't pass `onError` to its inner `ErrorBoundary` — data errors caught here still aren't reported to Sentry (accepted gap).
- **`ErrorState.secondaryAction`** (`@shared/ui`, used by `AsyncBoundary` and the per-route boundary in `AppLayout`) is a neutral `ReactNode` slot, not a `homeLink?: boolean` baked into the component — `ErrorState` must stay independent of `react-router` because `GlobalErrorBoundary` renders it outside `<RouterProvider>`. The `<Link to='/'>` for the per-route fallback is assembled in `AppLayout.tsx`, the one place that needs it.
- **404 pattern:** `error instanceof ApiError && error.status === 404` inside `errorFallback` (see `MoviePage.tsx`). Endpoints whose error DTO has `statusCode`/`message` instead of data must check `'statusCode' in response.data` and throw `ApiError` before reading fields (`getMovieDetail`, `getPopularMovies`).
- **`createStorageSlot`** (`@shared/lib`) — `localStorage` slot with zod-validated reads, cross-tab sync, `try/catch` around every access. `get()` memoizes the parsed value against the raw string (required: `useStorageSlot` feeds it to `useSyncExternalStore` as `getSnapshot`, which needs a stable reference). `set()` returns `boolean`. Failures go to the module-level `setStorageErrorReporter()` (details in `profile.md`). Keys: `kinoshka:favorites`, `kinoshka:watched`, `kinoshka:theme`, `kinoshka:genres`, `kinoshka:profile`.

## `/search`

- URL is the single source of truth: `?q`, filters, `?sort`, `?page` via `useFilterState()` + `useSearchParams()`.
- `useMovieCatalog()` (`src/pages/search/model/`) routes on `query.trim()`:
  - non-empty → `getSearchMovies()` (`/v1.5/movie/search`, native `page`). The API can't combine text + filters, so the sidebar is disabled **and** `usePageSync` strips `type`/`genres`/`yearFrom`/`yearTo`/`rating`/`sort` from the URL — both on the `'' → query` transition and on mount (deep link with stale params).
  - empty → `getMoviesPage()` (`/v1.5/movie`, cursor-based) — **emulates numbered pages** by walking the `next` cursor 1..N, memoizing each cursor step and page promise for `use()` stability.
- "Updating" indicator: `useCatalogUpdateStatus` — see the `useDeferredValue` gotcha in `AGENTS.md`.
- Two entry points build `/search` URLs from the same primitives: `Header` (live `?q` on 250ms debounce) and `HeroSection` on `/` (once, on submit). Both use `filtersToSearchParams()`/`EMPTY_FILTERS` (`@features/catalog-filter`) and `QUERY_MIN_LENGTH` (`@widgets/header`). Reuse them for any new entry point.

## Genres

- Canonical filter value is the **Russian** `name` from the live dictionary — `filtersToParams` sends it straight to `genres.name`. Display: `getGenreLabel(ruName)` via `GENRE_LABELS` (RU→EN), falling back to the raw Russian name. Result cards show `Movie.genre` in Russian as-is (accepted). Legacy English `?genres=Drama` links match nothing — accepted, no migration.
- `useGenreDictionary()` (`@entities/movie`) is **synchronous**, not Suspense: returns the cached dictionary (`kinoshka:genres`, 7-day TTL) or `STATIC_FALLBACK_GENRES`, and refreshes in the background from a `useEffect`. Failed refresh has a 60s in-memory cooldown. `invalidateGenreDictionary()` forces a refetch. No `AsyncBoundary` needed.
- `GenreSelector` is one component rendered from both `SearchSidebar` and the mobile filter sheet in `Search.tsx`.

## `/movie/:id`

`useMovieDetail(id)` = `Promise.allSettled([getMovieDetail(), getMovieImages()])`. Cast/crew/similar come from the same `MovieDtoV14`. Images rejecting → `images: []`, page still renders; detail rejecting (incl. 404) → `AsyncBoundary`.

## `/person/:id`

- `usePersonDetail(id)` = `use(getPersonDetail(id))` — no `bundleCache` needed (unlike `useMovieDetail`): a single stable promise straight from `createCachedFetcher`, not a `Promise.allSettled` combining two.
- Filmography is a compact text list built from `MovieInPerson` (no `poster`/`year`/`genre` in the DTO), not `Card` — and no `getMoviesByIds` fan-out to fetch real cards, to stay within the demo API's 200 req/day quota.
- Credits are grouped client-side by `enProfession` (`groupCreditsByProfession`, `src/pages/person/lib/`): a preferred order (`actor`, `director`, `writer`, `producer`, `composer`, `operator`) then the rest by first appearance, with an `Other` bucket for a missing `enProfession` and a raw-label fallback for one outside `PROFESSION_LABELS`.
- `facts[]` HTML tags are stripped in `mapDtoToPersonDetail`; HTML entities (`&laquo;`, `&nbsp;`, …) are **not** decoded — accepted limitation.
- `formatDate` (`@entities/movie/lib`) is called from the page layer, not the mapper — entity slices can't import each other. It formats in UTC (calendar dates from the API are UTC midnight, not a timezone-aware instant).
- 404 via `ApiError` (`error.status === 404`), same pattern as `/movie/:id`; `invalidatePersonDetail(id)` wired to `AsyncBoundary`'s `onRetry`.
- **DEV-only caveat:** an error snapshot replayed from `sessionStorage` within the 20s cooldown loses `ApiError`'s `status` (`createCachedFetcher` re-wraps it as a plain `Error`) — the 404 view falls back to the generic error for that replay. Same behavior on `/movie/:id`; prod is unaffected (session-persist is DEV-only).

## `/popular`

`usePopularMovies()` → `getPopularMovies({ slug: 'popular', limit: 10 })` → `GET /v1.5/list/{slug}`. The slug is **`popular`** (`top10-week` 404s). 24h TTL. Items are `PopularMovie = Movie & { position, positionDiff? }`; `positionDiff` renders as a plain signed integer (API doesn't say which sign means "rose"). `MovieInListDto` has no `type`/`genres`, so cards fall back to `type: 'movie'`, `genre: []` — accepted.

## Favorites (client-only)

`useFavorites()` stores `number[]` in `kinoshka:favorites`. `useFavoriteMovies()` = Suspense `use()` over `getMoviesByIds(ids)` (per-id `getMovieDetail` via `Promise.allSettled`; a 404'd id drops out; cache key = the id array). `Card` takes `isFavorite`/`onToggleFavorite` props instead of importing `@features/favorites` (entities can't import features) — callers in widgets/pages pass them down. `/watched` mirrors this (same `getMoviesByIds`, cache namespace `movies-by-ids`) — see `watched.md`.

## `/recommendations`

`computeRecommendationQuery(favorites)` (`@features/recommendations`) — pure rule: top-3 genres, avg rating − 1 (floored at 0), exclude favorited ids (`id: ['!<id>', …]`). Result goes straight to `getMoviesPage()`; no dedicated endpoint. Composition lives in `src/pages/recommendations/model/useRecommendedMovies.ts` (`null` = no favorites, `[]` = query returned nothing). `invalidateRecommendations(ids)` uses the last computed query remembered in a module variable, since favorites are async and not available at the `onRetry` call site. Named `useRecommendedMovies` (not the roadmap's `useRecommendations`) to follow `useFavorites`/`useFavoriteMovies`. Not gated behind the unused `recommendations` feature flag.
