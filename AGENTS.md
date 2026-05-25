# AGENTS.md

This file provides guidance when working with code in this repository.

Kinoshka — movie catalog SPA with a home feed, search, filters, and detail pages (overview, cast, media).

## Commands

```bash
pnpm dev        # start dev server with HMR
pnpm build      # type-check (tsc -b) then Vite production build
pnpm lint       # ESLint over all TS/TSX files
pnpm preview    # serve the production build locally
```

No test runner is configured yet.

## Architecture

React 19 + TypeScript 6 + Vite 8 single-page app.

**React Compiler is enabled.** The compiler (`babel-plugin-react-compiler`) runs via `@rolldown/plugin-babel` alongside `@vitejs/plugin-react` (see `vite.config.ts`). It automatically memoizes components and hooks, so manual `useMemo` / `useCallback` / `memo` calls are unnecessary and should be avoided — the compiler handles that.

**TypeScript strictness:** `noUnusedLocals`, `noUnusedParameters`, and `erasableSyntaxOnly` are all on. `erasableSyntaxOnly` means TypeScript-only syntax that can't be stripped without transformation (e.g. `enum`, `namespace`, parameter properties) is forbidden — use plain JS-compatible constructs instead.

**TypeScript style:** use `type` (not `interface`) for all type definitions.

**Icons** are sprite-based: `public/icons.svg` holds an SVG sprite; components reference symbols via `<use href="/icons.svg#<id>" />`.

**Fonts:** `index.html` loads three Google Fonts — Instrument Serif (display), Instrument Sans (UI), JetBrains Mono (mono). Use these; don't add new font imports.

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

## Responsive pattern

Pages and widgets ship paired `*Desktop.tsx` / `*Mobile.tsx` components. The `useViewport` hook (`src/shared/lib/useViewport.ts`) drives which variant renders. Follow this pattern when adding new page or widget components.
