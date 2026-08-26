# AGENTS.md

This file provides guidance when working with code in this repository.

Kinoshka — movie catalog SPA with a home feed, search, filters, and detail pages (overview, cast, media).

## Commands

A `Makefile` at the project root wraps all pnpm scripts. Prefer `make` over direct `pnpm` calls.

```bash
make dev          # start dev server with HMR
make build        # type-check (tsc -b) then Vite production build
make typecheck    # type-check only (tsc --noEmit)
make build-only   # Vite production build, no type-check
make lint         # oxlint over all TS/TSX files
make preview      # serve the production build locally
make install      # install dependencies
make hooks        # install husky git hooks (pnpm exec husky)
make clean        # remove dist and node_modules
make check        # lint + build (full validation)
make generate-api # regenerate API client from OpenAPI spec (re-run after spec changes)
make test         # run Vitest once
make test-watch   # run Vitest in watch mode
make coverage     # run Vitest with coverage report
make audit        # pnpm audit (prod deps, high severity)
```

**Commit hooks:** husky + lint-staged run `oxlint --fix --deny-warnings` on staged `*.{ts,tsx}` files pre-commit. Commit messages are enforced by commitlint (`@commitlint/config-conventional`); use `pnpm commit` (commitizen, `cz-conventional-changelog`) for a guided conventional-commit prompt instead of `git commit` directly.

## Architecture

React 19 + TypeScript 7 + Vite 8 single-page app.

**React Compiler is enabled.** The compiler (`babel-plugin-react-compiler`) runs via `@rolldown/plugin-babel` alongside `@vitejs/plugin-react` (see `vite.config.ts`). It automatically memoizes components and hooks, so manual `useMemo` / `useCallback` / `memo` calls are unnecessary and should be avoided — the compiler handles that.

**TypeScript strictness:** `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` are all on. `erasableSyntaxOnly` means TypeScript-only syntax that can't be stripped without transformation (e.g. `enum`, `namespace`, parameter properties) is forbidden — use plain JS-compatible constructs instead.

**TypeScript style:** use `type` (not `interface`) for all type definitions.

**Icons** are sprite-based: `public/icons.svg` holds an SVG sprite; components reference symbols via `<use href="/icons.svg#<id>" />`. See the [Icons](#icons) section for available IDs.

**Fonts:** `index.html` loads three Google Fonts — Instrument Serif (`--font-serif`), Instrument Sans (`--font-display` / `--font-body`, the default UI font), JetBrains Mono (`--font-mono`). Use these; don't add new font imports.

**Path aliases** correspond to FSD layers and are configured in both `vite.config.ts` and `tsconfig.app.json`: `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`. Use these aliases for all cross-layer imports.

## Project structure

The project follows [Feature-Sliced Design](https://feature-sliced.design/):

```
src/
├── app/          # providers, router, global styles
├── pages/        # route-level components
├── widgets/      # large reusable UI sections (header, mobile-chrome, movie-rail, search-sidebar)
├── features/     # user-facing interactive features (e.g. catalog-filter)
├── entities/     # business-domain objects (e.g. movie — types, data, UI)
└── shared/       # cross-cutting utilities and primitives (lib/, ui/)
```

Import direction: `pages → widgets → features → entities → shared`. Never import upward.

**Page-slice `model/` facade.** When a page needs to combine data/logic from more than one downward slice (e.g. both `@features/*` and `@entities/*`), put the composing hook in that page's own `model/` directory (`src/pages/<page>/model/`) rather than in `@entities` or `@features` — a lower slice can't legally import a higher one, but the page slice can import both downward. Example: `src/pages/search/model/useMovieCatalog.ts` composes `filtersToParams` (`@features/catalog-filter`) with `getSearchMovies`/`getMoviesPage` (`@entities/movie`) into the one hook the `/search` UI calls. Not exported through a public `index.ts` — page-internal only.

## Routing

React Router 7 (`react-router@^7.15.1`). Route config lives in `src/app/router.tsx`; provider setup in `src/app/providers.tsx`.

Routes: `/` (home feed), `/search` (search + filters), `/movie/:id` (detail — overview, cast, media tabs), `/favorites` (favorited movies), `/popular` (this week's popular movies, with rank badges), `/recommendations` (rule-based picks derived from favorites).

## API layer

The API client is auto-generated from the Kinopoisk OpenAPI spec using `@siberiacancode/apicraft`.

**Generated files** — never edit manually, regenerate instead:

- `src/shared/api/instance.gen.ts` — `ApiInstance` class built on `@siberiacancode/fetches`. `make generate-api` prepends `// @ts-nocheck` to this file after generation, so it isn't type-checked.
- `src/shared/api/types.gen.ts` — all request/response types

**Hand-written wrapper:** `src/shared/api/client.ts` instantiates `apiClient` from `instance.gen.ts` (base URL / API key from env) and installs a response interceptor that normalizes error messages. This file is safe to edit and is where cross-cutting API behavior (auth headers, error shaping) lives.

**Config:** `apicraft.config.ts` reads `APP_API_URL` from `.env.local` as the OpenAPI spec source.

**Environment:** create `.env.local` at the project root before running `make generate-api`:

```
APP_API_URL=<Kinopoisk OpenAPI spec URL>
VITE_API_KEY=<your API key>
VITE_BASE_URL=<base URL for API requests>
```

Import the client via `@shared/api`.

## Responsive pattern

Pages and widgets ship paired `*Desktop` / `*Mobile` components. The `useViewport` hook (`src/shared/lib/viewport/useViewport.ts`) drives which variant renders. Follow this pattern when adding new page or widget components.

- Mobile breakpoint: **720px** (`MOBILE_BREAKPOINT` in `useViewport.ts`)
- `HomeMobile`, `SearchMobile`, `MovieMobile`, `FavoritesMobile`, `PopularMobile` follow the standard `Component/{Component.tsx, Component.module.css, index.tsx}` directory pattern (see [Component structure](#component-structure)) — no longer flat `.tsx` files with inline styles. They compose the `mobile-chrome` (`MobileHeader`, `BottomNav`) and `movie-rail` widgets.

## Component structure

Every UI component lives in its own directory with a co-located CSS module:

```
ComponentName/
├── index.tsx              # named export of the component
└── ComponentName.module.css
```

Sub-components (e.g. `NavPill`, `ArrowBtn`) get their own nested directories following the same pattern.

Each slice in `widgets/` and `features/` exposes a **public API** via an `index.ts` at the slice root:

```
src/widgets/header/
├── index.ts               # export { Header } from './ui/Header'
└── ui/
    ├── Header/
    │   ├── index.tsx
    │   └── Header.module.css
    └── NavPill/
        ├── index.tsx
        └── NavPill.module.css
```

**Imports must always use the slice's public index, not internal paths:**

```ts
// ✓ correct
import { Header } from '@widgets/header'
import { useFilterState } from '@features/catalog-filter'

// ✗ wrong — reaches into internals
import { Header } from '@widgets/header/ui/Header'
```

**Stretched-link pattern (`Card`/`MobileCard`):** to avoid nesting interactive elements (`<button>` inside `<a>`, invalid HTML and bad for a11y/keyboard nav), the card's outer container is a plain `<div>` and the `react-router` `<Link>` wraps only the title text, giving it a real accessible name. The link gets a `::after` pseudo-element (`position: absolute; inset: 0`) that stretches its hit-area over the whole card via `position: relative` on the container; action buttons stay DOM siblings of the link (not descendants) with a higher `z-index` so they still receive clicks. Follow this pattern for any future card-like component that combines a primary navigation target with secondary action buttons.

**Dual-thumb range slider pattern (`YearRangeSlider`, `@features/catalog-filter/ui`):** for a two-handle range control, use two overlapping native `<input type="range">` elements instead of a hand-rolled pointer-drag implementation — it's less code and gets keyboard support (arrows, Home/End), focus, and screen-reader semantics for free. Cross-link `min`/`max` between the two inputs (the "from" input's `max` is the live value of "to", and vice versa) so the browser itself refuses to let the thumbs cross, with no manual clamping math. Give each `<input>` `pointer-events: none` except its own thumb pseudo-element (`::-webkit-slider-thumb`/`::-moz-range-thumb` get `pointer-events: auto`), so both thumbs stay independently draggable while fully overlapping; paint the native track transparent and render the visible track/fill as separate absolutely-positioned `div`s driven by inline `style` percentages. Commit to the parent's `onChange` on release (`onMouseUp`/`onTouchEnd`) **and** `onKeyUp` (keyboard changes fire neither mouseup nor touchend), gated on the committed pair actually differing from the last-committed one (Tab-focus alone delivers a `keyup` with no value change). Clamp/normalize incoming values into the slider's UI bounds on both initial state and the props-resync effect, since out-of-range or reversed (`from > to`) values would otherwise desync React's controlled `value` from the native DOM value.

**Theming pattern (`@features/theme`):** the app supports `light`/`dark`/`system`, resolved to `light`/`dark` and applied as a `data-theme` attribute on `<html>` (not `<body>`) via `useTheme()`'s effect. `src/app/styles/global.css` keeps the unconditional `:root { ... }` as the dark palette (no attribute = dark) and adds a parallel `:root[data-theme='light'] { ... }` block overriding the same variable names, each block also setting `color-scheme: dark`/`color-scheme: light` alongside the token overrides so native controls (scrollbars, both `<input type="range">` thumbs in `YearRangeSlider`) render in the matching OS-level skin instead of an OS-default one that clashes with the app theme. `index.html` runs a synchronous inline `<script>` in `<head>`, before `<div id="root">`, that reads `localStorage`, resolves the theme, and sets `data-theme` before first paint — this prevents a flash of the wrong theme (FOUC) that a post-mount `useEffect` alone couldn't avoid. Because of this, any new CSS must reference `var(--token)` and never hardcode a hex/rgba color — a hardcoded color silently ignores `data-theme='light'` and stays wrong in the light theme.

**`rankBadge` slot placement differs between `Card` and `MobileCard`.** Both take an optional `rankBadge?: ReactNode` prop (rendered by `PopularBadge` for `/popular`'s rail and page), but the free corner isn't the same on the two components: `Card`'s bottom edge is occupied by `.actions` (`position: absolute; bottom: 10px; z-index: 2`, revealed on hover/focus-within), so its `rankBadge` is grouped with `.ratingBadge` in a `.topBadges` flex row in the top-left corner instead — and deliberately kept at the implicit `z-index: auto` (not matching `.title::after`'s `z-index: 1`) so the stretched-link overlay still paints on top of it and the corner stays clickable; giving `.topBadges` an explicit `z-index: 1` would tie-break by DOM order in the card's `isolation: isolate` stacking context and create a dead click zone. `MobileCard` has no `.actions` overlay and no `typeBadge`, so its top corners are free for `.rating`/`.favoriteBtn` and `rankBadge` goes in the free bottom-left corner instead (`position: absolute; bottom: 8px; left: 8px`). Any future overlay badge added to either component should check which corner is actually free (and whether it needs to out-stack the stretched-link overlay) before picking a z-index.

**`IconButton` lives in `@shared/ui`, not `@widgets/header`.** It moved there from `src/widgets/header/ui/IconButton/` during the theme-toggle work because it was never Header-specific (its `.module.css` was already fully `var(--...)`-driven), and `@features/theme`'s `ThemeToggle` needs to render it — `features/*` can't import from `widgets/*` under this repo's `pages → widgets → features → entities → shared` import direction, so a shared, generic component like this has to live at the `shared/` layer to be usable from both `widgets/header`/`widgets/mobile-chrome` and `features/theme`.

## Styles

All styles use **CSS Modules** (`ComponentName.module.css`). Import as `import s from './ComponentName.module.css'` and apply via `className={s.className}`.

- Hover states → CSS `:hover` pseudo-class (not `useState` + inline style toggling)
- Conditional classes → template literals: `` `${s.btn} ${active ? s.active : ''}` ``
- Dynamic values (e.g. computed heights) → inline `style` only when truly necessary
- CSS variables (`var(--font-body)`, etc.) defined in `src/app/styles/global.css` — use them, don't hardcode

### Design tokens

Non-exhaustive selection — see `src/app/styles/global.css` for the full list (also defines `--border-subtle/-light/-strong/-heavy`, `--bg-glass*`, `--accent-warm-glow/-shadow`, `--accent-rating-border`, etc.):

```
Backgrounds  --bg-primary #0F0D11 · --bg-secondary #18161B · --bg-elevated #211E24 · --bg-hover #2A262F
             --bg-chip rgba(184,173,171,0.06) — subtle chip/button background

Text         --text-primary · --text-secondary · --text-muted · --text-faint
             --text-disabled #3A3639 — disabled controls

Accent       --accent-warm (CTA/links) · --accent-warm-hover
             --accent-warm-tint rgba(209,142,95,0.12) — lightest warm bg (active states)
             --accent-warm-soft rgba(209,142,95,0.15) — warm bg tint (selected chips)
             --accent-warm-border rgba(209,142,95,0.35) — warm border
             --accent-cool #D7EEF3 · --accent-rating #E6B86A (stars)

Borders      --border-faint rgba(184,173,171,0.08) · --border-soft rgba(184,173,171,0.15) · --border-medium rgba(184,173,171,0.25)

Overlay      --overlay-backdrop rgba(0,0,0,0.55) — modal/drawer backdrop

Fonts        --font-display · --font-body · --font-serif · --font-mono
```

### Global utility classes

- `.fade-up` — entrance animation (fadeUp 320ms)
- `.hide-scrollbar` — hides scrollbar cross-browser

Available keyframes: `shimmer`, `pulse`, `fadeUp`.

## Icons

`public/icons.svg` currently contains only social icons:

```
bluesky-icon  bluesky-clip  discord-icon  documentation-icon
github-icon   social-icon   x-icon
```

For UI icons (search, arrow, close, chevrons, play, star, etc.) use the React components from `@shared/ui` (e.g. `SearchIcon`, `CloseIcon`, `StarIcon`, `PlayIcon`, `ChevronLeftIcon`). Do not add them to the sprite.

## Key public APIs

| Import                      | Exports                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@entities/movie`           | `Card`, `MobileCard`, `Poster`, `PopularBadge`, `Movie`, `MovieDetail`, `MovieType`, `PopularMovie`, `CastMember`, `CrewMember`, `Genre`, `STATIC_FALLBACK_GENRES`, `CATALOG`, `useNewMovies()`, `useTopRatedMovies()`, `usePopularMovies()`, `useMovieDetail()`, `MovieDetailBundle`, `useGenreDictionary()`, `invalidateGenreDictionary()`, `getMoviesPage()`, `invalidateMoviesPage()`, `invalidateTopRatedMovies()`, `invalidateNewMovies()`, `invalidatePopularMovies()`, `invalidateMovieDetail()`, `CatalogParams`, `CatalogPageResult`, `getSearchMovies()`, `SearchMoviesResult`, `getMoviesByIds()`, `MovieImage`, `formatCurrency()`, `formatDate()`, `resetAllCachedFetchers()` |
| `@features/catalog-filter`  | `useFilterState()`, `ActiveFilterChips`, `GenreSelector`, `YearRangeSlider`, `FilterState`, `ActiveChip`, `filtersToParams()`, `CatalogQueryParams`, `SORT_LABELS`, `getFilterFromSearchParams()`, `filtersToSearchParams()`, `EMPTY_FILTERS`                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `@features/favorites`       | `useFavorites()` → `{ ids, isFavorite, toggle, add, remove, clear }`, `useFavoriteMovies()` (Suspense, `use()` over `getMoviesByIds(ids)`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@features/recommendations` | `computeRecommendationQuery()` — pure `Movie[] → NonNullable<CatalogParams> \| null` rule (top-3 genres, avg rating − 1 buffer, exclude favorited ids); see [Data state](#data-state) for the page-slice hook built on top                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@features/theme`           | `useTheme()` → `{ theme, resolvedTheme, setTheme, toggleTheme }`, `Theme` (`'light' \| 'dark' \| 'system'`), `ThemeToggle`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@shared/ui`                | `*Icon` components (`StarIcon`, `SearchIcon`, `CloseIcon`, `PlayIcon`, `ChevronLeftIcon`, etc.), `IconButton`, `Footer`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `ErrorBoundary`, `AsyncBoundary`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `@shared/lib`               | `useViewport()` → `{ isMobile: boolean }`, `createStorageSlot()`, `useStorageSlot()`, `createSessionCache()`, `useDebouncedValue()`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `@shared/config`            | `useFeatureFlag()`, `FeatureGate`, `FeatureName`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `@shared/api`               | `apiClient` (configured instance, wired into `@entities/movie` data hooks — see [Data state](#data-state)), `ApiError` (subclass of `Error` carrying the HTTP `status`, thrown by the response interceptor in `client.ts` — see [Data state](#data-state) for the 404-handling pattern built on it)                                                                                                                                                                                                                                                                                                                                                                                         |

## Formatting

`formatCurrency()`/`formatDate()` (`@entities/movie/lib`) both take an optional second `locale` param that defaults to `navigator.language`, so money (`Budget`/`Box office`) and date (`Release date`) values in `DetailsTab`/`MovieMobile`'s Details rows render in whichever language the visitor's browser is set to, instead of a hardcoded locale. Call sites never pass `locale` explicitly — only tests do, for determinism (jsdom's default `navigator.language` is `en-US`, so the default-locale assertions read as English output; ru-RU assertions pass the locale explicitly to prove the plumbing works). Any future formatter over an API-sourced numeric/date field should follow the same "explicit `locale` param, default to `navigator.language`" shape rather than hardcoding one.

## Data state

API integration is in progress, not all-or-nothing:

- **Live via `apiClient`:** the home feed rails consume `useNewMovies()` / `useTopRatedMovies()` (`@entities/movie`), which call `getMovies.ts` → `apiClient.getV15Movie(...)`. The `/search` page is **also live-data**: `SearchDesktop`/`SearchMobile` read `?q`/filters/`?sort`/`?page` from the URL (single source of truth, via `useFilterState()` + native `useSearchParams()`) and render results through `useMovieCatalog()` — a facade hook in the **page slice** (`src/pages/search/model/useMovieCatalog.ts`, not `@entities/movie`, since it legally imports both `@features/catalog-filter` and `@entities/movie` downward). There is no `useSearch` hook (it was removed); `useMovieCatalog` routes by `query.trim()` between two mutually exclusive endpoints:
  - non-empty query → `getSearchMovies()` (`/v1.5/movie/search`, native `page`), filters/sort sidebar disabled (Variant A — the API can't combine free-text query with filters in one request). Disabling the sidebar is only cosmetic guard rail — the actual fix lives in `usePageSync` (`src/pages/search/model/usePageSync.ts`), which atomically strips `type`/`genres`/`yearFrom`/`yearTo`/`rating`/`sort` from the URL via `stripFilterAndSortParams` whenever text search becomes active (both on the `'' → non-empty query` transition, and on a deep link/refresh landing directly on `/search?q=...` with stale filter/sort params already in the URL — a mount-only effect handles the latter, since the transition-based effect only fires on a change between renders and never on first mount);
  - empty query → `getMoviesPage()` (`@entities/movie`), which drives `/v1.5/movie` (cursor-based, no native `page`) and **emulates numbered pagination** by walking the `next` cursor 1..N, memoizing each cursor step and the resulting page-level `Promise` for `use()`/Suspense stability.
  - The canonical genre filter value is the Russian `name` from the live genre dictionary (see the `useGenreDictionary()` bullet below) — exactly what `genres.name` expects, so `filtersToParams.ts` sends `filters.genres` straight through with no translation/skip step. Display labels go the other way: `src/features/catalog-filter/lib/genreMap.ts`'s `GENRE_LABELS` (RU→EN, inverted from the old EN→RU `GENRE_MAP`/`toApiGenre`) and `getGenreLabel(ruName)` fall back to the raw Russian name for dictionary genres with no known English label, rather than skipping them. Results from the API return Russian genre names as-is in `Movie.genre` (no reverse RU→EN mapping on display — accepted default, see `SearchDesktop.tsx`). **Breaking change:** genre values in the URL used to be English (`?genres=Drama`); legacy links like that no longer match any dictionary entry (the chip renders as "active" but filters nothing) — no migration was done, since `?genres=` is a short-lived query param, not a long-lived contract (same principle as `Movie.genre` display above). See `docs/plans/20260815-dynamic-genre-dictionary.md`.
  - **Third live-data integration: the genre dictionary.** `useGenreDictionary()` (`@entities/movie/hooks`) backs the `GenreSelector` component (`@features/catalog-filter/ui`, one shared component used by both `SearchSidebar` (desktop) and `SearchMobile.tsx` — same "shared component, two responsive call sites" pattern as `ActiveFilterChips`) — replaces the old hardcoded `ALL_GENRES` chip lists in both. It fetches `GET /v1.5/dictionary/genres` via `getGenreDictionary()` (`@entities/movie/api`) and caches the result in `localStorage` (key `kinoshka:genres`, 7-day TTL) through `createStorageSlot` (`@shared/lib`) — its first real consumer, which surfaced (and fixed) a referential-stability bug in `createStorageSlot.get()`: `get()` used to re-`JSON.parse` on every call, so for object/array values it returned a new reference each time; `useStorageSlot` passes `slot.get` straight into `useSyncExternalStore` as `getSnapshot`, which requires a referentially-stable snapshot between calls when the underlying store hasn't changed — otherwise React treats it as changed on every render, causing an infinite re-render loop plus React's "getSnapshot should be cached" dev warning. `get()` now memoizes the parsed value against the raw `localStorage` string and only re-parses when the raw string changes (see the docblock in `src/shared/lib/storage/storage.ts`); any future `createStorageSlot` consumer with an object/array value gets this for free. Genres change rarely, so this is a background-revalidate cache, **not** a Suspense/`use()`-blocking one: `useGenreDictionary()` is a plain synchronous hook that always returns immediately, either the cached dictionary or `STATIC_FALLBACK_GENRES` (6 genres) as a fallback, and kicks off a background `refreshGenreDictionary()` from a `useEffect` when the cache is empty or stale. A failed background fetch is cooled down (in-memory `lastAttemptAt`, 60s, not persisted) so a 403/500-ing endpoint doesn't get hammered — the filter stays usable on the static fallback either way. `invalidateGenreDictionary()` forces a cache clear/refetch. No `AsyncBoundary`/skeleton is needed for this piece of UI, unlike the other live-data integrations below.
  - `createCachedFetcher` (`@entities/movie/api/createCachedFetcher.ts`) was generalized from a fixed `Movie[]` result to `createCachedFetcher<P, R = Movie[]>` so both `getSearchMovies`/`getMoviesPage` (`R = { movies, totalPages }`) and the original `getMovies` rails (default `R = Movie[]`, unchanged call sites) share the same TTL/session-persist/403-cooldown cache. The returned fetcher also carries `invalidate(params)`/`clear()` (`Object.assign`'d onto the function) for point cache eviction — see the `AsyncBoundary`/retry note below.
  - **`useDeferredValue` never stages a stale value on data sourced from `useSearchParams()`, because `setSearchParams` wraps its navigation in `React.startTransition`.** `useCatalogUpdateStatus` (`src/pages/search/model/useCatalogUpdateStatus.ts`) drives the `/search` "keep showing old results while fetching" indicator (Suspense stale-content pattern, no `loader`s so `useNavigation()`/`useTransition()` don't apply here — see the plan referenced above). Naively calling `useDeferredValue(query)` etc. directly on values read from `useSearchParams()` never shows an intermediate stale render: the render where they change is already running in react-router's transition lane, React's internal `includesOnlyNonUrgentLanes` check sees that and hands back the new value immediately, so the deferred and live values change in the same commit and the "updating" indicator never lights up. The fix is to mirror the live values into a plain `useState` from inside a `useEffect` (effects run after commit, outside the transition, so the mirror update lands on the urgent lane) and run `useDeferredValue` over that mirror instead of the raw URL-derived values — see the hook's docblock for the full trace. This is a repo-wide gotcha, not specific to this one hook: any future `useDeferredValue` usage over `useSearchParams()`-derived state will hit the same silent no-op unless it goes through the same mirror-via-effect indirection.
  - **Shared "search → URL" contract, two entry points:** the home page's `HeroSection` (`src/pages/home/ui/HeroSection/HeroSection.tsx`) is a second entry point into `/search`, alongside `Header`. Both build the target URL from the same primitives — `filtersToSearchParams()`/`EMPTY_FILTERS` (`@features/catalog-filter`) for `type`, and `QUERY_MIN_LENGTH` (exported from `@widgets/header`, originally module-private to `Header.tsx`) as the shared min-length gate for `q` — instead of each hardcoding its own literal/threshold. `Header` writes `?q` live via debounce as the user types on an already-open `/search`; `HeroSection` writes the full URL once, on explicit submit (Enter or the "Search" button), since it lives on `/` and has no live results to update. Any future page-level search entry point should reuse this same pair of exports rather than re-deriving the min-length/param-building logic. See `docs/plans/20260814-home-hero-search-wiring.md`.
- **Also live-data: the movie-detail page (`/movie/:id`).** `MoviePage.tsx` calls `useMovieDetail(id)` (`@entities/movie/hooks`), which composes two independent fetchers via `Promise.allSettled`: `getMovieDetail()` → `apiClient.getV15MovieById(...)` (cast/crew/similar movies are fields on the same `MovieDtoV14`, not separate endpoints) and `getMovieImages()` → `apiClient.getV15Image(...)`. If `images` rejects, the hook swallows it and returns `images: []` so the page still renders; if `detail` rejects (including a 404), the rejection propagates to the `AsyncBoundary` around `MoviePage`. `MOCK_DETAIL` has been deleted from `@entities/movie`; `CATALOG` remains, still used by `HomeMobile`. `ALL_GENRES` has been removed entirely — its last two consumers (`SearchSidebar`, `SearchMobile.tsx`) now render the live `GenreSelector`/`useGenreDictionary()` (see the genre dictionary bullet above).
  - **404/error-handling pattern (reusable for future pages):** the response interceptor in `src/shared/api/client.ts` rejects with `ApiError extends Error { status?: number }` instead of a bare `Error`, so callers can branch on HTTP status. `AsyncBoundary` (`@shared/ui`) takes an optional `errorFallback?: (params: { error: Error | null; reset: () => void }) => ReactNode` prop (default preserves the old single-`ErrorState` behavior); `MoviePage.tsx` passes a fallback that checks `error instanceof ApiError && error.status === 404` to render a distinct "not found" `ErrorState` (vs. a generic one for other errors), both wired to `onRetry={reset}`. Any future page needing to distinguish 404 from other failures should reuse this `ApiError` + `AsyncBoundary.errorFallback` pattern rather than inventing a new one.
  - **Retry really re-fetches:** `AsyncBoundary` also takes an optional `onRetry?: () => void`, invoked _before_ the underlying `reset()`. Double-click protection comes solely from a synchronous `isRetryingRef` flag set to `true` before `onRetry`/`reset` run and reset to `false` unconditionally on every `errorFallback` render (first error, a repeat render of the same cached error after a failed retry, or a genuinely new error) — not from comparing the `error` reference across renders, since real fetchers (`createCachedFetcher`/`getMoviesPage`) can replay the exact same cached `Error` object by reference on a retried request, which would otherwise leave Retry permanently dead instead of just cooldown-delayed. Each retry-capable async boundary wires `onRetry` to a companion `invalidate*` export sitting next to its data hook — `invalidateTopRatedMovies`/`invalidateNewMovies` (home rails), `invalidateMovieCatalog` (`/search`, via `useMovieCatalog.ts`), `invalidateMovieDetail` (`/movie/:id`, invalidates both `getMovieDetail`/`getMovieImages`) — so clicking Retry evicts that specific cache entry and hits the network immediately, instead of replaying the same rejected promise until `ERROR_CACHE_TTL_MS` (20s) expires.
- **Still mock data:** `HomeMobile` still renders `CATALOG` from `@entities/movie`.
- **Fourth live-data integration: `/popular` (rail + page).** `usePopularMovies()` (`@entities/movie/hooks`) is a Suspense hook over `getPopularMovies({ slug: 'popular', limit: 10 })` (`@entities/movie/api`), which calls `apiClient.getV15ListBySlug({ path: { slug }, query: { limit } })` → `GET /v1.5/list/{slug}`. The real slug is **`popular`**, not the `top10-week` the roadmap originally guessed — `GET /v1.5/list/top10-week` 404s, `GET /v1.5/list/popular` is the live one. Same status-narrowing pattern as `getMovieDetail.ts`: the endpoint's error DTO (401/403/404) carries `statusCode`/`message` instead of `movies`, so `getPopularMovies` checks `'statusCode' in response.data` and throws `ApiError` before touching `.movies`. Each `docs[]` item maps through the existing `mapDocToMovie()` plus `{ position, positionDiff }` into a new `PopularMovie = Movie & { position: number; positionDiff?: number | null }` type (`@entities/movie`) — `PopularMoviesRail` (home) and `PopularPage`'s `PopularDesktop`/`PopularMobile` both render it, with `MovieRailDesktop`/`Card`/`MobileCard` taking an optional `rankBadge`/`PopularBadge` slot for the position number and signed `positionDiff` (rendered as a plain signed integer, no up/down arrow — the API doesn't document which sign means "rose" vs "fell"). `MovieInListDto` (the `/list` endpoint's movie shape) **lacks `type`/`genres`**, unlike `SearchMovieDtoV14` — `mapDocToMovie` falls back to its existing defaults (`type: 'movie'`, `genre: []`), so every popular-list card shows a generic `'movie'` type badge; this is an accepted default, same principle as the RU-genre-display one described above for search results, not a bug to fix. `createCachedFetcher` (`@entities/movie/api/createCachedFetcher.ts`) gained an optional third `options?: { ttlMs?: number }` param (default unchanged: 5 minutes) specifically so `getPopularMovies` could opt into a 24-hour TTL — `24 * 60 * 60 * 1000` ms, passed as `{ ttlMs: ... }` — since a curated "popular this week" list changes far less often than the other rails. **That 24h TTL is in-memory-only in production**: `createSessionCache` (backing `createCachedFetcher`) only persists to `sessionStorage` under `import.meta.env.DEV` (see the Testing note below and `src/shared/lib/sessionCache/sessionCache.ts`), so in prod the cache survives re-renders/navigation for the life of the SPA session but not a page reload — still useful for staying under the demo tier's 200-requests/day quota during a long session.
- **Client-only (no API endpoint): Favorites.** `@features/favorites`'s `useFavorites()` stores the favorited id set as `number[]` in `localStorage` (key `kinoshka:favorites`) through `createStorageSlot` — same pattern as `kinoshka:genres` (see the genre dictionary bullet above), including zod-validated reads with an empty-array fallback and cross-tab sync via the `storage` event. The theme feature (`@features/theme`) follows the same `createStorageSlot` pattern for its own key, `kinoshka:theme` (see the theming pattern note under [Component structure](#component-structure)). There is no favorites API endpoint; loading the favorited movies' full data is a client-side composition, not a live-data integration in the sense of the bullets above: `getMoviesByIds()` (`@entities/movie/api`) calls the existing `getMovieDetail(id)` per id via `Promise.allSettled` (partial failure — a 404'd id just drops out of the result) and is wrapped in `createCachedFetcher<number[], Movie[]>`, cache-keyed on the id array itself so it naturally invalidates whenever the favorited set changes. `useFavoriteMovies()` (`@features/favorites`) is the Suspense-style `use()` wrapper around it, meant to render inside an `AsyncBoundary` — same shape as the other `use()`-based data hooks in this codebase. `Card`/`MobileCard` take optional `isFavorite`/`onToggleFavorite` props (both undefined → no heart button rendered, preserving old behavior for not-yet-wired call sites) rather than importing `@features/favorites` directly, since `entities/movie` can't import upward from `features/` under this repo's FSD import direction — callers in `widgets/`/`pages/` call `useFavorites()` themselves and pass `isFavorite`/`toggle` down as props.
- **Fifth live-data integration: `/recommendations` (rule-based, no new API layer).** `computeRecommendationQuery(favorites: Movie[]): NonNullable<CatalogParams> | null` (`@features/recommendations/lib`) is a pure rule — top-3 favorited genres by frequency, average favorited rating minus a −1 buffer (floored at 0) as `rating.kp`, and `id: ['!<id>', ...]` to exclude already-favorited movies — that turns the favorited set into a `CatalogParams` query. There is no dedicated recommendations endpoint or API wrapper: the query is handed straight to the same `getMoviesPage()` (`@entities/movie`) that `/search`'s empty-query path already uses, for free reuse of its cursor-pagination cache, TTL, and 403-cooldown. `favorites: Movie[]` (from `useFavoriteMovies()`) is itself Suspense data, so — same FSD reasoning as `useMovieCatalog` (see the "Page-slice `model/` facade" note above) — the favorites+rule composition can't live in `@entities`/`@features` and instead lives in `src/pages/recommendations/model/useRecommendedMovies.ts`: `useRecommendedMovies(): Movie[] | null` calls `useFavoriteMovies()` → `computeRecommendationQuery()` → (if non-null) `use(getMoviesPage(query, 1)).movies`, returning `null` when the rule itself can't produce a query (empty favorites) as distinct from `[]` (query ran, catalog had nothing to offer). The companion invalidator `invalidateRecommendations(ids: number[])` — analogous to `invalidateMovieCatalog` — lives in the same file: since the rule's input (`favorites`) is itself async and not synchronously available at the `AsyncBoundary`'s `onRetry` call site (unlike `useMovieCatalog`, where `filters`/`sort`/`page` are ordinary synchronous props), the hook remembers the last computed `query` in a module-level variable as a render side effect and the invalidator uses it to evict both `getMoviesByIds`'s cache entry and `getMoviesPage(lastQuery, 1)`'s.
  - **Naming: `useRecommendedMovies`, not `useRecommendations`.** Roadmap 2.4's literal wording says "Хук `useRecommendations()`", but the implementation deliberately deviates: `useFavorites()`/`useFavoriteMovies()` already establish the project convention that `use<Domain>` returns raw/underlying data while `use<Domain>Movies` is the Suspense hook that resolves to `Movie[]`. `useRecommendedMovies` follows that existing convention instead of the roadmap's literal name.
  - **Feature flag not wired.** `FeatureName` in `src/shared/config/features/useFeatureFlag.ts` already lists `recommendations: false` with no consumer. This page is intentionally not gated behind that flag — same precedent as `popularThisWeek`/`toggleTheme`, both left `false` in the same map after their features shipped.

When adding a new feature, check whether an equivalent live-data hook already exists before reaching for mock data.

**Testing:** API calls are mocked in tests via **MSW** (`msw/node`, `setupServer()` in `src/test/setup.ts`, `onUnhandledRequest: 'error'`). Vitest config lives inline in `vite.config.ts` (`test: { environment: 'jsdom', setupFiles: [...], globals: true }` — `globals: true` means `describe`/`it`/`expect` need no import). **Zod** validates data at the localStorage/sessionStorage boundary only — API responses are trusted as-is against the generated types (no Zod schema), matching `getMovies.ts`/`getSearchMovies.ts`/`getMoviesPage.ts`/`getMovieDetail.ts`/`getMovieImages.ts`/`getGenreDictionary.ts`.
