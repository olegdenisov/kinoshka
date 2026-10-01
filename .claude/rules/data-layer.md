---
paths:
  - 'src/entities/movie/{api,hooks,model,lib}/**'
  - 'src/entities/person/**'
  - 'src/shared/api/**'
  - 'src/shared/ui/{QueryBoundary,ErrorBoundary,ErrorState}/**'
  - 'src/pages/{movie,person,popular,recommendations,favorites}/**'
  - 'src/pages/recommendations/api/**'
  - 'src/features/{favorites,recommendations}/**'
  - 'src/entities/*/api/*Api.ts'
  - 'src/app/store.ts'
---

# Data layer

`/search` and genres → `search-catalog.md`; storage slots → `storage.md`.

## RTK Query

- **One `baseApi`** (`@shared/api`) with `fakeBaseQuery`; entities, features and pages add endpoints via `injectEndpoints` — the shared point can only live in `shared`, and entity slices can't import each other. Every endpoint is a `queryFn` over the generated `apiClient`, so its interceptor and types stay the single HTTP path.
- **Errors in the store must be serializable:** `queryFn` returns `QueryError` (`toQueryError`), never an `ApiError` instance. `status` is kept — the 404 view and `getMoviesByIds` tell "no such movie" from a failure by it.
- **Composition = `queryFn` + `dispatch(endpoint.initiate(arg, { subscribe: false })).unwrap()`.** Cache is shared between endpoints (`getMoviesByIds` reuses `/movie/:id` details, `getMoviesPage` reuses cursor steps). A composing endpoint that references another endpoint lives in its own `injectEndpoints` call — inside one initializer the type inference becomes circular.
- `keepUnusedDataFor: 300` keeps the TTL of the old fetcher cache (5 min). Test stores are created per test (`makeStore`), so no global cache reset is needed.
- **Retry = `refetch` via `QueryBoundary`.** The boundary shows the error over stale `data` (RTK Query keeps old data after a failed refetch) and never hands `undefined` to children. It doesn't report to Sentry — data errors never reach it (accepted gap).
- **A query with `skip`/not started has `data === undefined` without `isLoading`** — `QueryBoundary` treats it as loading; don't render children on `data` alone.
- **`ErrorState` must not depend on `react-router`:** `GlobalErrorBoundary` renders it outside `<RouterProvider>`, hence the neutral `secondaryAction` slot instead of a built-in home link.
- **Error DTOs:** endpoints that return `statusCode`/`message` instead of data must check `'statusCode' in response.data` and return the error before reading fields.

## `/movie/:id`, `/person/:id`

- Images rejecting → `images: []`, page still renders; detail rejecting (incl. 404) → `QueryBoundary`.
- Person filmography is a text list, not `Card`s: `MovieInPerson` has no poster/year/genre, and a `getMoviesByIds` fan-out would burn the quota.
- `facts[]`: HTML tags stripped, entities (`&laquo;`, `&nbsp;`) **not** decoded — accepted.
- API calendar dates are UTC midnight → format in UTC.

## `/popular`

- Slug is **`popular`** (`top10-week` 404s).
- API doesn't define which sign of `positionDiff` means "rose" → shown as a plain signed integer.
- `MovieInListDto` has no `type`/`genres` → cards fall back to `type: 'movie'`, `genre: []` — accepted, no enrichment request (quota).

## Favorites and other id lists (`getMoviesByIds`)

- A 404'd id silently drops out (`Promise.allSettled`); all ids 404 → empty grid, but any non-404 failure with no movies → error with Retry.
- Cache key = the id array → any change to the list refetches the whole grid (details themselves come from the shared `/movie/:id` cache).
- One request per id, no limit or pagination — a long list burns the 200 req/day quota.

## `/recommendations`

- `getRecommendations` takes no argument and reads favorite ids from state, so its cache key never changes on its own — the `Recommendations` tag is the only refresh path (`toggleFavorite` on success, tab-sync `hydrated`).
- Cards get no favorite toggle (a click changes the rule's input → recompute and refetch the grid), but do get the watchlist one — the query doesn't depend on it.
