---
paths:
  - 'src/entities/movie/{api,hooks,model,lib}/**'
  - 'src/entities/person/**'
  - 'src/shared/api/**'
  - 'src/shared/lib/store/**'
  - 'src/shared/ui/{QueryBoundary,ErrorBoundary,ErrorState}/**'
  - 'src/pages/search/model/movieCatalogStore.ts'
  - 'src/pages/recommendations/model/**'
  - 'src/pages/{movie,person,popular,recommendations,favorites}/**'
  - 'src/features/{favorites,recommendations}/**'
---

# Data layer

`/search` and genres → `search-catalog.md`; storage slots → `storage.md`.

## Shared building blocks

- **`createQueryStore`** (`@shared/lib`) — use it for every new request; one store per request, instance lives in the owning slice (`shared` holds no domain data). It is not Zustand-provided caching: dedup, TTL and the cooldown are ours.
- **Error cooldown (20s) applies only to the automatic start from `useQuery`**, to protect the 200 req/day quota. Imperative `fetch()` and `refetch()` bypass it and re-request a cached error — otherwise a composed store's Retry would be dead for 20s because nested steps would replay the old rejection. The quota is protected by the top-level key's cooldown.
- **Compose through `store.fetch(params)`**, not by calling the raw fetcher — it shares cache and in-flight dedup (`getMoviesByIds` reuses movie details, the catalog reuses cursor steps).
- **Requests start from an effect, not during render.** `isFetching` is derived synchronously in the first render for a missing/stale key, otherwise `keepPreviousData` would show one frame of old data without the indicator.
- **A fetcher must not resolve `undefined`:** `data === undefined` means "no data". Recommendations return `null` instead of using `skip`, which would leave `QueryBoundary` on its fallback forever.
- **Errors are stored as-is** (`ApiError` with `status`) — the store isn't serializable by design; the `/movie/:id` 404 branch relies on it.
- Devtools middleware goes behind an `import.meta.env.DEV` branch, not `enabled:` — `enabled` doesn't tree-shake the middleware out of the prod bundle.
- Dictionary stores skip an empty successful response only when the cache is already non-empty (keeps good data against a flaky empty reply, but a first empty answer is still stored).
- **`QueryBoundary`:** `isError` shows `ErrorState` with Retry = `refetch` even when stale data exists (same as `main`), but not while a retry is in flight (`isError` is false during `isFetching`). It doesn't report to Sentry — data errors caught here never reach it (accepted gap).
- Entries are never evicted (page lifetime): stale data shows immediately and refreshes in the background. DEV no longer persists the cache to `sessionStorage`.
- **`ErrorState` must not depend on `react-router`:** `GlobalErrorBoundary` renders it outside `<RouterProvider>`, hence the neutral `secondaryAction` slot instead of a built-in home link.
- **Error DTOs:** endpoints that return `statusCode`/`message` instead of data must check `'statusCode' in response.data` and throw `ApiError` before reading fields.

## `/movie/:id`, `/person/:id`

- Images rejecting → `images: []`, page still renders; detail rejecting (incl. 404) → `QueryBoundary` error state.
- Person filmography is a text list, not `Card`s: `MovieInPerson` has no poster/year/genre, and a `getMoviesByIds` fan-out would burn the quota.
- `facts[]`: HTML tags stripped, entities (`&laquo;`, `&nbsp;`) **not** decoded — accepted.
- API calendar dates are UTC midnight → format in UTC.

## `/popular`

- Slug is **`popular`** (`top10-week` 404s).
- API doesn't define which sign of `positionDiff` means "rose" → shown as a plain signed integer.
- `MovieInListDto` has no `type`/`genres` → cards fall back to `type: 'movie'`, `genre: []` — accepted, no enrichment request (quota).

## Favorites and other id lists (`getMoviesByIds`)

- A 404'd id silently drops out (`Promise.allSettled`).
- Cache key = the id array → any change to the list refetches the whole grid.
- One request per id, no limit or pagination — a long list burns the 200 req/day quota.

## `/recommendations`

- The store key is the favorites `ids`: a changed list changes the key and refetches by itself; Retry is a plain `refetch`, no module-level variable. The fetcher runs the whole chain (`moviesByIdsStore.fetch` → rule → catalog fetch), so there is a single `QueryResult`.
- Cards get no favorite toggle (a click changes the rule's input → recompute and refetch the grid), but do get the watchlist one — the query doesn't depend on it.
