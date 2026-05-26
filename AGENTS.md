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
```

No test runner is configured yet.

## Architecture

React 19 + TypeScript 6 + Vite 8 single-page app.

**React Compiler is enabled.** The compiler (`babel-plugin-react-compiler`) runs via `@rolldown/plugin-babel` alongside `@vitejs/plugin-react` (see `vite.config.ts`). It automatically memoizes components and hooks, so manual `useMemo` / `useCallback` / `memo` calls are unnecessary and should be avoided — the compiler handles that.

**TypeScript strictness:** `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` are all on. `erasableSyntaxOnly` means TypeScript-only syntax that can't be stripped without transformation (e.g. `enum`, `namespace`, parameter properties) is forbidden — use plain JS-compatible constructs instead.

**TypeScript style:** use `type` (not `interface`) for all type definitions.

**Icons** are sprite-based: `public/icons.svg` holds an SVG sprite; components reference symbols via `<use href="/icons.svg#<id>" />`.

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
APP_API_KEY=<your API key>
```

Import the client via `@shared/api`.

## Responsive pattern

Pages and widgets ship paired `*Desktop` / `*Mobile` components. The `useViewport` hook (`src/shared/lib/useViewport.ts`) drives which variant renders. Follow this pattern when adding new page or widget components.

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
