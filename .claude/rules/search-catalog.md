---
paths:
  - 'src/pages/search/**'
  - 'src/features/catalog-filter/**'
  - 'src/widgets/header/**'
  - 'src/pages/home/ui/HeroSection/**'
  - 'src/entities/movie/model/{genre,country,dictionaries}.ts'
---

# `/search`, filters, genres

## `/search`

- The URL is the single source of truth for query, filters, sort and page.
- The API can't combine text search with filters: with a non-empty query the sidebar is disabled **and** `normalizeSearchUrl` strips filter/sort params from the URL — on the `'' → query` transition and on mount (deep link with stale params). It runs from an `effect` created in `catalog`'s connect hook, because a deep link to a dirty URL can happen without remounting the page.
- **One URL write per mutation:** every change goes through `updateSearchUrl` = a single `urlAtom.set(fn, true)`; page reset and filter cleanup happen inside that same call, not reactively. `withSearchParams` is deliberately not used: writing several of its atoms in one tick keeps only the first in the URL, and a `withComputed` reset changes the atom but not the URL.
- `searchDraft` (input text) follows the URL via `withComputed(state => { ifChanged(…) })`; the naive `withComputed(() => query())` overwrites direct writes.
- Filter mode uses a cursor-based endpoint; numbered pages are emulated by walking the cursor 1..N.
- Every entry point that builds a `/search` URL (`Header`, `HeroSection`, any new one) uses `filtersToSearchParams`/`EMPTY_FILTERS`/`QUERY_MIN_LENGTH` — don't hand-build params.

## Genres

- The canonical filter value is the **Russian** `name` from the live dictionary; English is display-only. Result cards show genres in Russian — accepted. Legacy English `?genres=Drama` links match nothing — accepted, no migration.
- Dictionaries are read synchronously (live data, else the static fallback); a refetch of a stale dictionary shows the fallback meanwhile. After an error there is no retry until page reload (replaces the old 60s cooldown) — accepted.
- The same rule applies to countries — canonical value is the Russian `name`, the API has no `enName`, English labels exist only for the shortlist.
- Shortlist names (`STATIC_FALLBACK_COUNTRIES`) must match the live dictionary spelling exactly (it's `Корея Южная`, not `Южная Корея`) — a mismatch sends a dead `countries.name` and the chip drops out of the shortlist once the dictionary loads.
- A new dictionary is a new entry in `dictionaries.ts` (own persist key), not a copy of the genre model.

## Filters

- `list` (collection) is single-select because the API ORs multiple `lists` values, which produces unpredictable results when combined with AND-filters like genre/country.
- Platforms and lists are hardcoded in `filterOptions.ts` — the API has no platform dictionary, and `/list` is dominated by auto-generated collections (`country1`, `year2018`, etc.) that are not useful as user-facing filters.
- Every new `FilterState` field must go through `getFilterFromSearchParams`/`filtersToSearchParams`; `catalogParams` derives from `filters`, so a field missing there neither refetches nor shows a chip.
