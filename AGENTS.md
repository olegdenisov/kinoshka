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

Routes: `/` (home feed), `/search` (search + filters), `/movie/:id` (detail — overview, cast, media tabs).

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
- `HomeMobile`, `SearchMobile`, `MovieMobile` are flat `.tsx` files with no CSS module (inline styles instead) — but they are fully built out, not scaffolding. They compose the `mobile-chrome` (`MobileHeader`, `BottomNav`) and `movie-rail` widgets.

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

| Import | Exports |
|--------|---------|
| `@entities/movie` | `Card`, `MobileCard`, `Poster`, `Movie`, `MovieDetail`, `MovieType`, `CastMember`, `CrewMember`, `CATALOG`, `ALL_GENRES`, `useNewMovies()`, `useTopRatedMovies()`, `useMovieDetail()`, `MovieDetailBundle`, `getMoviesPage()`, `CatalogParams`, `CatalogPageResult`, `getSearchMovies()`, `SearchMoviesResult`, `MovieImage`, `formatCurrency()`, `resetAllCachedFetchers()` |
| `@features/catalog-filter` | `useFilterState()`, `ActiveFilterChips`, `FilterState`, `ActiveChip`, `filtersToParams()`, `CatalogQueryParams`, `SORT_LABELS`, `getFilterFromSearchParams()`, `filtersToSearchParams()` |
| `@shared/ui` | `*Icon` components (`StarIcon`, `SearchIcon`, `CloseIcon`, `PlayIcon`, `ChevronLeftIcon`, etc.), `Footer`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `ErrorBoundary`, `AsyncBoundary` |
| `@shared/lib` | `useViewport()` → `{ isMobile: boolean }`, `useStorageSlot()`, `createSessionCache()`, `useDebouncedValue()` |
| `@shared/config` | `useFeatureFlag()`, `FeatureGate`, `FeatureName` |
| `@shared/api` | `apiClient` (configured instance, wired into `@entities/movie` data hooks — see [Data state](#data-state)), `ApiError` (subclass of `Error` carrying the HTTP `status`, thrown by the response interceptor in `client.ts` — see [Data state](#data-state) for the 404-handling pattern built on it) |

## Data state

API integration is in progress, not all-or-nothing:
- **Live via `apiClient`:** the home feed rails consume `useNewMovies()` / `useTopRatedMovies()` (`@entities/movie`), which call `getMovies.ts` → `apiClient.getV15Movie(...)`. The `/search` page is **also live-data**: `SearchDesktop`/`SearchMobile` read `?q`/filters/`?sort`/`?page` from the URL (single source of truth, via `useFilterState()` + native `useSearchParams()`) and render results through `useMovieCatalog()` — a facade hook in the **page slice** (`src/pages/search/model/useMovieCatalog.ts`, not `@entities/movie`, since it legally imports both `@features/catalog-filter` and `@entities/movie` downward). There is no `useSearch` hook (it was removed); `useMovieCatalog` routes by `query.trim()` between two mutually exclusive endpoints:
  - non-empty query → `getSearchMovies()` (`/v1.5/movie/search`, native `page`), filters/sort sidebar disabled (Variant A — the API can't combine free-text query with filters in one request). Disabling the sidebar is only cosmetic guard rail — the actual fix lives in `usePageSync` (`src/pages/search/model/usePageSync.ts`), which atomically strips `type`/`genres`/`yearFrom`/`yearTo`/`rating`/`sort` from the URL via `stripFilterAndSortParams` whenever text search becomes active (both on the `'' → non-empty query` transition, and on a deep link/refresh landing directly on `/search?q=...` with stale filter/sort params already in the URL — a mount-only effect handles the latter, since the transition-based effect only fires on a change between renders and never on first mount);
  - empty query → `getMoviesPage()` (`@entities/movie`), which drives `/v1.5/movie` (cursor-based, no native `page`) and **emulates numbered pagination** by walking the `next` cursor 1..N, memoizing each cursor step and the resulting page-level `Promise` for `use()`/Suspense stability.
  - UI-side genre filters are English; the API's `genres.name` expects Russian — `src/features/catalog-filter/lib/genreMap.ts` provides a static EN→RU dictionary (`toApiGenre`), with unmapped genres skipped rather than sent. Results from the API return Russian genre names as-is in `Movie.genre` (no reverse RU→EN mapping on display — accepted default, see `SearchDesktop.tsx`).
  - `createCachedFetcher` (`@entities/movie/api/createCachedFetcher.ts`) was generalized from a fixed `Movie[]` result to `createCachedFetcher<P, R = Movie[]>` so both `getSearchMovies`/`getMoviesPage` (`R = { movies, totalPages }`) and the original `getMovies` rails (default `R = Movie[]`, unchanged call sites) share the same TTL/session-persist/403-cooldown cache.
  - **`useDeferredValue` never stages a stale value on data sourced from `useSearchParams()`, because `setSearchParams` wraps its navigation in `React.startTransition`.** `useCatalogUpdateStatus` (`src/pages/search/model/useCatalogUpdateStatus.ts`) drives the `/search` "keep showing old results while fetching" indicator (Suspense stale-content pattern, no `loader`s so `useNavigation()`/`useTransition()` don't apply here — see the plan referenced above). Naively calling `useDeferredValue(query)` etc. directly on values read from `useSearchParams()` never shows an intermediate stale render: the render where they change is already running in react-router's transition lane, React's internal `includesOnlyNonUrgentLanes` check sees that and hands back the new value immediately, so the deferred and live values change in the same commit and the "updating" indicator never lights up. The fix is to mirror the live values into a plain `useState` from inside a `useEffect` (effects run after commit, outside the transition, so the mirror update lands on the urgent lane) and run `useDeferredValue` over that mirror instead of the raw URL-derived values — see the hook's docblock for the full trace. This is a repo-wide gotcha, not specific to this one hook: any future `useDeferredValue` usage over `useSearchParams()`-derived state will hit the same silent no-op unless it goes through the same mirror-via-effect indirection.
- **Also live-data: the movie-detail page (`/movie/:id`).** `MoviePage.tsx` calls `useMovieDetail(id)` (`@entities/movie/hooks`), which composes two independent fetchers via `Promise.allSettled`: `getMovieDetail()` → `apiClient.getV15MovieById(...)` (cast/crew/similar movies are fields on the same `MovieDtoV14`, not separate endpoints) and `getMovieImages()` → `apiClient.getV15Image(...)`. If `images` rejects, the hook swallows it and returns `images: []` so the page still renders; if `detail` rejects (including a 404), the rejection propagates to the `AsyncBoundary` around `MoviePage`. `MOCK_DETAIL` has been deleted from `@entities/movie`; `CATALOG`/`ALL_GENRES` remain, still used by `HomeMobile`.
  - **404/error-handling pattern (reusable for future pages):** the response interceptor in `src/shared/api/client.ts` rejects with `ApiError extends Error { status?: number }` instead of a bare `Error`, so callers can branch on HTTP status. `AsyncBoundary` (`@shared/ui`) takes an optional `errorFallback?: (params: { error: Error | null; reset: () => void }) => ReactNode` prop (default preserves the old single-`ErrorState` behavior); `MoviePage.tsx` passes a fallback that checks `error instanceof ApiError && error.status === 404` to render a distinct "not found" `ErrorState` (vs. a generic one for other errors), both wired to `onRetry={reset}`. Any future page needing to distinguish 404 from other failures should reuse this `ApiError` + `AsyncBoundary.errorFallback` pattern rather than inventing a new one.
- **Still mock data:** `HomeMobile` still renders `CATALOG` / `ALL_GENRES` from `@entities/movie`.

When adding a new feature, check whether an equivalent live-data hook already exists before reaching for mock data.

**Testing:** API calls are mocked in tests via **MSW** (`msw/node`, `setupServer()` in `src/test/setup.ts`, `onUnhandledRequest: 'error'`). Vitest config lives inline in `vite.config.ts` (`test: { environment: 'jsdom', setupFiles: [...], globals: true }` — `globals: true` means `describe`/`it`/`expect` need no import). **Zod** validates data at the localStorage/sessionStorage boundary only — API responses are trusted as-is against the generated types (no Zod schema), matching `getMovies.ts`/`getSearchMovies.ts`/`getMoviesPage.ts`/`getMovieDetail.ts`/`getMovieImages.ts`.
