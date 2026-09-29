---
paths:
  - 'src/pages/search/**'
  - 'src/features/catalog-filter/**'
  - 'src/widgets/header/**'
  - 'src/pages/home/ui/HeroSection/**'
  - 'src/entities/movie/hooks/useGenreDictionary.ts'
  - 'src/entities/movie/api/genreDictionaryCache.ts'
  - 'src/entities/movie/model/genre.ts'
---

# `/search`, filters, genres

## `/search`

- The URL is the single source of truth for query, filters, sort and page.
- The API can't combine text search with filters: with a non-empty query the sidebar is disabled **and** `usePageSync` strips filter/sort params from the URL — on the `'' → query` transition and on mount (deep link with stale params).
- Filter mode uses a cursor-based endpoint; numbered pages are emulated by walking the cursor 1..N.
- Every entry point that builds a `/search` URL (`Header`, `HeroSection`, any new one) uses `filtersToSearchParams`/`EMPTY_FILTERS`/`QUERY_MIN_LENGTH` — don't hand-build params.

## Genres

- The canonical filter value is the **Russian** `name` from the live dictionary; English is display-only. Result cards show genres in Russian — accepted. Legacy English `?genres=Drama` links match nothing — accepted, no migration.
- `useGenreDictionary()` is **synchronous**, not Suspense (cached/static fallback + background refresh) — no `AsyncBoundary` needed.
