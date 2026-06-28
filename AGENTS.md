# AGENTS.md

This file provides guidance when working with code in this repository.

Kinoshka — movie catalog SPA with a home feed, search, filters, and detail pages (overview, cast, media).

## Commands

A `Makefile` at the project root wraps all pnpm scripts. Prefer `make` over direct `pnpm` calls.

```bash
make dev          # start dev server with HMR
make build        # type-check (tsc -b) then Vite production build
make lint         # ESLint over all TS/TSX files
make preview      # serve the production build locally
make install      # install dependencies
make clean        # remove dist and node_modules
make check        # lint + build (full validation)
make generate-api # regenerate API client from OpenAPI spec (re-run after spec changes)
make test         # run Vitest once
make test-watch   # run Vitest in watch mode
make coverage     # run Vitest with coverage report
```

## Architecture

React 19 + TypeScript 6 + Vite 8 single-page app.

**React Compiler is enabled.** The compiler (`babel-plugin-react-compiler`) runs via `@rolldown/plugin-babel` alongside `@vitejs/plugin-react` (see `vite.config.ts`). It automatically memoizes components and hooks, so manual `useMemo` / `useCallback` / `memo` calls are unnecessary and should be avoided — the compiler handles that.

**TypeScript strictness:** `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` are all on. `erasableSyntaxOnly` means TypeScript-only syntax that can't be stripped without transformation (e.g. `enum`, `namespace`, parameter properties) is forbidden — use plain JS-compatible constructs instead.

**TypeScript style:** use `type` (not `interface`) for all type definitions.

**Icons** are sprite-based: `public/icons.svg` holds an SVG sprite; components reference symbols via `<use href="/icons.svg#<id>" />`. See the [Icons](#icons) section for available IDs.

**Fonts:** `index.html` loads three Google Fonts — Instrument Serif (display), Instrument Sans (UI), JetBrains Mono (mono). Use these; don't add new font imports.

**Path aliases** correspond to FSD layers and are configured in both `vite.config.ts` and `tsconfig.app.json`: `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`. Use these aliases for all cross-layer imports.

## Project structure

The project follows [Feature-Sliced Design](https://feature-sliced.design/):

```
src/
├── app/          # providers, router, global styles
├── pages/        # route-level components
├── widgets/      # large reusable UI sections (header, bottom nav, rails)
├── features/     # user-facing interactive features (e.g. catalog-filter)
├── entities/     # business-domain objects (e.g. movie — types, data, UI)
└── shared/       # cross-cutting utilities and primitives (lib/, ui/)
```

Import direction: `pages → widgets → features → entities → shared`. Never import upward.

## Routing

React Router 7 (`react-router@^7.15.1`). Route config lives in `src/app/router.tsx`; provider setup in `src/app/providers.tsx`.

Routes: `/` (home feed), `/search` (search + filters), `/movie/:id` (detail — overview, cast, media tabs).

## API layer

The API client is auto-generated from the Kinopoisk OpenAPI spec using `@siberiacancode/apicraft`.

**Generated files** — never edit manually, regenerate instead:
- `src/shared/api/instance.gen.ts` — typed `ApiInstance` class built on `@siberiacancode/fetches`
- `src/shared/api/types.gen.ts` — all request/response types

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
- `HomeMobile`, `SearchMobile`, `MovieMobile` are flat `.tsx` stubs with no CSS module — desktop variants are complete, mobile variants are scaffolding only.

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
| `@entities/movie` | `Card`, `MobileCard`, `Poster`, `Movie`, `MovieDetail`, `CATALOG`, `MOCK_DETAIL`, `ALL_GENRES` |
| `@features/catalog-filter` | `useFilterState()`, `ActiveFilterChips`, `FilterState`, `ActiveChip` |
| `@shared/ui` | `Icon`, `Footer`, `Spinner`, `Skeleton`, `EmptyState`, `ErrorState`, `ErrorBoundary`, `AsyncBoundary` |
| `@shared/lib` | `useViewport()` → `{ isMobile: boolean }`, `useStorageSlot()`, `createStorageSlot()` |
| `@shared/config` | `useFeatureFlag()`, `FeatureGate`, `FeatureName` |
| `@shared/api` | `apiClient` (configured instance, not yet wired to any component) |

## Data state

All pages currently render **mock data** from `@entities/movie` (`CATALOG`, `MOCK_DETAIL`, `ALL_GENRES`). The `apiClient` instance exists but is not connected to any component. New features should use mock data until API integration is explicitly scoped.
