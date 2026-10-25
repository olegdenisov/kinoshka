---
paths:
  - 'src/pages/search/**'
  - 'src/features/catalog-filter/**'
  - 'src/widgets/header/**'
  - 'src/pages/home/ui/HeroSection/**'
  - 'src/entities/movie/hooks/useGenreDictionary.ts'
  - 'src/entities/movie/model/genre.ts'
  - 'src/entities/movie/api/createDictionaryCache.ts'
  - 'src/entities/movie/hooks/useCountryDictionary.ts'
  - 'src/entities/movie/model/country.ts'
---

# `/search`, filters, genres

## `/search`

- The URL is the single source of truth for query, filters, sort and page.
- The API can't combine text search with filters: with a non-empty query the sidebar is disabled **and** `usePageSync` strips filter/sort params from the URL — on the `'' → query` transition and on mount (deep link with stale params).
- Filter mode uses a cursor-based endpoint; numbered pages are emulated by walking the cursor 1..N.
- Every entry point that builds a `/search` URL (`Header`, `HeroSection`, any new one) uses `filtersToSearchParams`/`EMPTY_FILTERS`/`QUERY_MIN_LENGTH` — don't hand-build params.

## Genres

- The canonical filter value is the **Russian** `name` from the live dictionary; English is display-only. Result cards show genres in Russian — accepted. Legacy English `?genres=Drama` links match nothing — accepted, no migration.
- `useGenreDictionary()` is **synchronous** (`data ?? slot cache ?? static fallback` + background refresh) — no `QueryBoundary` needed.
- The same rule applies to countries — canonical value is the Russian `name`, the API has no `enName`, English labels exist only for the shortlist.
- Shortlist names (`STATIC_FALLBACK_COUNTRIES`) must match the live dictionary spelling exactly (it's `Корея Южная`, not `Южная Корея`) — a mismatch sends a dead `countries.name` and the chip drops out of the shortlist once the dictionary loads.
- A new dictionary is a new `createDictionaryCache` instance (own `kinoshka:<name>` key and cooldown) plus its own endpoint, not a copy of the genre code.
- The cooldown lives in `queryFn`: RTK Query dedupes in-flight requests but refetches a failed query on every new subscription, so without it every selector remount after an error would hit the quota.

## Filters

- `list` (collection) is single-select because the API ORs multiple `lists` values, which produces unpredictable results when combined with AND-filters like genre/country.
- Platforms and lists are hardcoded in `filterOptions.ts` — the API has no platform dictionary, and `/list` is dominated by auto-generated collections (`country1`, `year2018`, etc.) that are not useful as user-facing filters.
