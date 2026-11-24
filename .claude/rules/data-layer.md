---
paths:
  - 'src/entities/movie/{api,model,lib}/**'
  - 'src/entities/person/**'
  - 'src/shared/api/**'
  - 'src/shared/lib/query/**'
  - 'src/shared/ui/{AsyncContent,ErrorBoundary,ErrorState}/**'
  - 'src/pages/{movie,person,popular,recommendations,favorites}/**'
  - 'src/features/{favorites,recommendations}/**'
---

# Data layer

`/search` and genres → `search-catalog.md`; storage slots → `storage.md`.

## Shared building blocks

- **Cache only on `action` requests** (`withQueryCache`, `@shared/lib`). `withCache` on a `computed` saves nothing: the body runs before the cache lookup, the request goes out and is then cancelled. On an action a hit skips the call and parallel calls share one request. `withAsync` must precede `withCache`.
- Resources (`computed(async) + withAsyncData`) are uncached and call the cached action via `await wrap(fetchX(params))`.
- **No error cache** (the old 20s one is gone, deliberate): a rejection isn't cached; a dependency-free resource doesn't refetch after an error until `retry()`; a loader re-entering a failed route sends one new request.
- `withQueryCache` persists to `sessionStorage` **only in DEV**; in prod the cache is in-memory and lost on reload.
- `AsyncContent` is presentational (no Reatom import) and the retry button calls the resource's `retry()`. Skeleton for lists: `status().isFirstPending`; refresh over old data: `isPending && !isFirstPending`; detail pages: `!ready()`.
- **`ErrorState` must not depend on the router:** `GlobalErrorBoundary` renders it outside the route tree, hence the neutral `secondaryAction` slot instead of a built-in home link.
- **Error DTOs:** endpoints that return `statusCode`/`message` instead of data must check `'statusCode' in response.data` and throw `ApiError` before reading fields (done in the action body).

## `/movie/:id`, `/person/:id`

- Images rejecting → `images: []`, page still renders; detail rejecting (incl. 404) → error state via `AsyncContent`.
- Person filmography is a text list, not `Card`s: `MovieInPerson` has no poster/year/genre, and a `getMoviesByIds` fan-out would burn the quota.
- `facts[]`: HTML tags stripped, entities (`&laquo;`, `&nbsp;`) **not** decoded — accepted.
- API calendar dates are UTC midnight → format in UTC.
- An invalid `:id` doesn't unmatch the route: the loader throws `ApiError` 404. `loader.data()` isn't cleared on leaving the route.

## `/popular`

- Slug is **`popular`** (`top10-week` 404s).
- API doesn't define which sign of `positionDiff` means "rose" → shown as a plain signed integer.
- `MovieInListDto` has no `type`/`genres` → cards fall back to `type: 'movie'`, `genre: []` — accepted, no enrichment request (quota).

## Favorites and other id lists (`getMoviesByIds`)

- A 404'd id silently drops out (`Promise.allSettled`).
- `reatomMoviesByIds(ids, name)` takes a reactive source, not an array; the id array is the dependency → any change to the list refetches the grid (per-id detail calls stay cached).
- One request per id, no limit or pagination — a long list burns the 200 req/day quota.

## `/recommendations`

- Cards get no favorite toggle (a click changes the rule's input → recompute and refetch the grid), but do get the watchlist one — the query doesn't depend on it.
