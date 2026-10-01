---
paths:
  - 'src/entities/movie/{api,hooks,model,lib}/**'
  - 'src/entities/person/**'
  - 'src/shared/api/**'
  - 'src/shared/lib/{sessionCache,cachedFetcher}/**'
  - 'src/shared/ui/{AsyncBoundary,ErrorBoundary,ErrorState}/**'
  - 'src/pages/{movie,person,popular,recommendations,favorites}/**'
  - 'src/features/{favorites,recommendations}/**'
---

# Data layer

`/search` and genres → `search-catalog.md`; storage slots → `storage.md`.

## Shared building blocks

- **`createCachedFetcher`** (`@shared/lib`) — use it for every new fetcher. Lives in `shared` because `@entities/person` needs it too and entity slices can't import each other. Errors are cached for 20s, so a Retry without `invalidate` replays the cached rejection.
- `createSessionCache` persists to `sessionStorage` **only in DEV**; in prod the cache is in-memory and lost on reload.
- **`AsyncBoundary`:** every retry-capable boundary wires `onRetry` to the `invalidate*` export next to its hook. Double-click protection is the synchronous `isRetryingRef`, **not** an error-reference comparison (fetchers replay the same `Error` object). It doesn't pass `onError` to its inner `ErrorBoundary` — data errors caught here never reach Sentry (accepted gap).
- **`ErrorState` must not depend on `react-router`:** `GlobalErrorBoundary` renders it outside `<RouterProvider>`, hence the neutral `secondaryAction` slot instead of a built-in home link.
- **Error DTOs:** endpoints that return `statusCode`/`message` instead of data must check `'statusCode' in response.data` and throw `ApiError` before reading fields.

## `/movie/:id`, `/person/:id`

- Images rejecting → `images: []`, page still renders; detail rejecting (incl. 404) → `AsyncBoundary`.
- Person filmography is a text list, not `Card`s: `MovieInPerson` has no poster/year/genre, and a `getMoviesByIds` fan-out would burn the quota.
- `facts[]`: HTML tags stripped, entities (`&laquo;`, `&nbsp;`) **not** decoded — accepted.
- API calendar dates are UTC midnight → format in UTC.
- **DEV only:** an error snapshot replayed from `sessionStorage` loses `ApiError.status`, so the 404 view falls back to the generic error.

## `/popular`

- Slug is **`popular`** (`top10-week` 404s).
- API doesn't define which sign of `positionDiff` means "rose" → shown as a plain signed integer.
- `MovieInListDto` has no `type`/`genres` → cards fall back to `type: 'movie'`, `genre: []` — accepted, no enrichment request (quota).

## Favorites and other id lists (`getMoviesByIds`)

- A 404'd id silently drops out (`Promise.allSettled`).
- Cache key = the id array → any change to the list refetches the whole grid.
- One request per id, no limit or pagination — a long list burns the 200 req/day quota.

## `/recommendations`

- `getRecommendations` takes no argument and reads favorite ids from state, so its cache key never changes on its own — the `Recommendations` tag is the only refresh path (`toggleFavorite` on success, tab-sync `hydrated`).
- Cards get no favorite toggle (a click changes the rule's input → recompute and refetch the grid), but do get the watchlist one — the query doesn't depend on it.
