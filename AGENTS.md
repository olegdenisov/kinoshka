# AGENTS.md

This file provides guidance when working with code in this repository.

Kinoshka — movie catalog SPA with a home feed, search, filters, and detail pages (overview, cast, media).

## Topic docs — read before touching these areas

This file holds only repo-wide conventions. Area-specific decisions and gotchas live in `.claude/rules/*.md`. Claude Code loads them automatically via their `paths:` frontmatter; **other agents (Codex, etc.) must open the matching file by hand before editing files in that area.** Full history/rationale for each area is in the linked `docs/plans/completed/*.md`.

| Doc                              | Read when touching                                                                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/rules/data-layer.md`    | `src/entities/movie/**`, `src/shared/api/**`, `src/pages/{search,movie,popular,recommendations}/**`, favorites/catalog-filter/recommendations features, `AsyncBoundary` |
| `.claude/rules/ui-patterns.md`   | `Card`, `YearRangeSlider`, `@features/theme`, `src/app/styles/**`                                                                                                       |
| `.claude/rules/profile.md`       | `@features/profile`, `/profile`, `src/shared/lib/storage/**`, `AvatarCircle`, `BottomNav`                                                                               |
| `.claude/rules/sentry.md`        | `src/app/sentry*`, `src/main.tsx`, `src/app/router.tsx`, `sentry*.config.ts`, `provision-sentry-telemetry.ts`, `.mcp.json`                                              |
| `.claude/rules/analytics.md`     | `src/shared/lib/analytics/**` and the four `trackEvent`/`trackPageview` call sites                                                                                      |
| `.claude/rules/build-budgets.md` | `vite.config.ts`, `bundle.config.ts`, `package.json` (`size-limit`), `knip.jsonc`, `lazyNamed`                                                                          |
| `.claude/rules/csp.md`           | `vercel.json`, `index.html`, `public/font-swap.js`                                                                                                                      |
| `.claude/rules/e2e.md`           | `e2e/**`, `playwright.config.ts`, `.github/workflows/e2e.yml`                                                                                                           |
| `.claude/rules/lighthouse.md`    | `lighthouserc.cjs`, `.github/workflows/lighthouse.yml`, `.github/scripts/**`                                                                                            |

When a new area-specific decision is worth recording, add it to the matching rule file (or create one with a `paths:` frontmatter and a row in this table) — not here. Record the rule and the one-line reason; the story of how it was found belongs in the plan.

## Git workflow

`main` is protected — changes land only via pull request, never a direct push. Work on a branch and open a PR to merge into `main`.

## Commands

A `Makefile` at the project root wraps all pnpm scripts. Prefer `make` over direct `pnpm` calls.

```bash
make dev          # start dev server with HMR
make build        # type-check (tsc -b) then Vite production build
make typecheck    # type-check only (tsc -b — without -b the solution-style tsconfig checks 0 files)
make build-only   # Vite production build, no type-check
make lint         # oxlint over all TS/TSX files
make format       # oxfmt write
make format-check # oxfmt --check
make preview      # serve the production build locally
make install      # install dependencies
make hooks        # install husky git hooks (pnpm exec husky)
make clean        # remove dist and node_modules
make check        # format-check lint build (full validation)
make generate-api # regenerate API client from OpenAPI spec (re-run after spec changes)
make test         # run Vitest once
make test-watch   # run Vitest in watch mode
make coverage     # run Vitest with coverage report
make audit        # pnpm audit (prod deps, high severity)
make analyze      # ANALYZE=true production build → dist/stats.html (bundle treemap)
make size         # size-limit — per-chunk size budgets against dist/
make knip         # unused exports/deps/files detector
make e2e          # Playwright E2E (requires make build-only first)
make e2e-install  # playwright install --with-deps chromium webkit
make lighthouse   # local Lighthouse smoke against vite preview — not the CI gate
make sentry-telemetry # provision Sentry alerts + dashboard via sentry CLI (see sentry.md)
```

**Commit hooks:** husky + lint-staged run `oxlint --fix --deny-warnings` on staged `*.{ts,tsx}` files pre-commit. Commit messages are enforced by commitlint (`@commitlint/config-conventional`); use `pnpm commit` (commitizen) for a guided conventional-commit prompt. The lint-staged glob doesn't cover `.cjs`/`.js` (`lighthouserc.cjs`, `public/font-swap.js`) — those are only checked by repo-wide `make lint`/`make format-check`.

## Architecture

React 19 + TypeScript 7 + Vite 8 (Rolldown) single-page app.

- **React Compiler is enabled** (`babel-plugin-react-compiler` via `@rolldown/plugin-babel`). Don't write manual `useMemo` / `useCallback` / `memo`.
- **TypeScript strictness:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no `enum`, `namespace`, parameter properties).
- **TypeScript style:** `type`, not `interface`. Single exception: `interface Window` in `src/vite-env.d.ts` (global declaration merging only works through `interface`).
- **Fonts:** Instrument Serif (`--font-serif`), Instrument Sans (`--font-display`/`--font-body`), JetBrains Mono (`--font-mono`), loaded in `index.html` (async-load details → `csp.md`). Don't add new font imports.
- **Path aliases** map to FSD layers (`vite.config.ts` + `tsconfig.app.json`): `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`. Use them for all cross-layer imports.

## Project structure

[Feature-Sliced Design](https://feature-sliced.design/):

```
src/
├── app/          # providers, router, layouts, global styles, sentry bootstrap
├── pages/        # route-level components
├── widgets/      # large reusable UI sections (header, mobile-chrome, movie-rail, search-sidebar)
├── features/     # user-facing interactive features (catalog-filter, favorites, theme, profile, recommendations)
├── entities/     # business-domain objects (movie — types, api, hooks, UI)
└── shared/       # cross-cutting utilities and primitives (api/, lib/, ui/, config/)
```

Import direction: `pages → widgets → features → entities → shared`. Never import upward. A generic component needed by both a widget and a feature goes to `@shared/ui` (that's why `IconButton`/`AvatarCircle` live there).

**Public API:** every slice in `widgets/` and `features/` (and `entities/movie`) exposes an `index.ts`. Import only through it — `import { Header } from '@widgets/header'`, never `@widgets/header/ui/Header`. The barrel `index.ts` is the source of truth for what a slice exports — read it before adding a new hook; an equivalent may already exist.

**Page-slice `model/` facade.** When a page needs to combine more than one downward slice (e.g. `@features/*` + `@entities/*`), put the composing hook in `src/pages/<page>/model/` — a lower slice can't import a higher one. Page-internal, not exported. Examples: `useMovieCatalog`, `useRecommendedMovies`, `useSearchAnalytics`.

## Routing

React Router 7. Route config: `src/app/router.tsx` (every route lazy via `lazyNamed`, router wrapped with `Sentry.wrapCreateBrowserRouter`); providers: `src/app/providers.tsx`; chrome/layout: `src/app/layouts/AppLayout.tsx`.

Routes: `/` (home feed), `/search` (search + filters), `/movie/:id` (overview, cast, media tabs), `/favorites`, `/popular` (weekly popular with rank badges), `/recommendations` (rule-based from favorites), `/profile` (client-only profile).

Adding a route touches: `router.tsx`, `AppLayout`'s `ROUTE_CHROME`, a `codeSplitting` group + `size-limit` entry (see `build-budgets.md`), and possibly the Lighthouse URL list and an e2e spec.

## API layer

Client auto-generated from the Kinopoisk OpenAPI spec by `@siberiacancode/apicraft`.

- **Generated, never edit:** `src/shared/api/instance.gen.ts` (`// @ts-nocheck` prepended by `make generate-api`), `src/shared/api/types.gen.ts`.
- **Hand-written:** `src/shared/api/client.ts` — instantiates `apiClient`, response interceptor throws `ApiError extends Error { status?: number }`. Cross-cutting API behavior lives here.
- `apicraft.config.ts` reads `APP_API_URL` from `.env.local`.

`.env.local` (required for `make generate-api` / real data):

```
APP_API_URL=<Kinopoisk OpenAPI spec URL>
VITE_API_KEY=<your API key>
VITE_BASE_URL=<base URL for API requests>
```

Optional: `VITE_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` (see `sentry.md`), `VITE_PLAUSIBLE_DOMAIN` (see `analytics.md`). Import the client via `@shared/api`. The demo API tier is **200 requests/day** — keep that in mind for anything that hits the live API (e2e, Lighthouse, manual testing).

## Responsive pattern

Mobile-first CSS, not paired components: one component + one CSS module per page/widget, mobile layout is the base, desktop overrides go in `@media (min-width: 720px)`. Hover-only controls use `@media (hover: hover) and (pointer: fine)`, not a JS `isMobile` branch. No `*Desktop`/`*Mobile` pairs. Background: `docs/plans/completed/20260827-mobile-first-adaptive-layout.md`.

- Breakpoint **720px** (`MOBILE_BREAKPOINT` in `src/shared/lib/viewport/useViewport.ts`).
- `useViewport()` has exactly **two** legitimate consumers — cases where the choice is _which component mounts_, not how it looks:
  1. `AppLayout.tsx` — `Header` vs `MobileHeader`+`BottomNav`. Can't be CSS-only: `Header` runs a `?q`-debounce effect that mutates the URL even when hidden.
  2. `src/pages/search/ui/Search/Search.tsx` — `SearchSidebar` vs mobile filter bar + `BottomSheet` (and `SortSelect` vs sort `BottomSheet`).
- Don't add a third `useViewport()` consumer for anything CSS can express.

## Component structure

```
ComponentName/
├── index.tsx              # named export of the component
└── ComponentName.module.css
```

Sub-components get their own nested directories with the same layout. Slice layout example: `src/widgets/header/index.ts` + `ui/Header/…`, `ui/NavPill/…`.

Component-specific patterns (stretched-link `Card`, dual-thumb `YearRangeSlider`, `rankBadge` z-index, theming) → `.claude/rules/ui-patterns.md`.

## Styles

CSS Modules: `import s from './ComponentName.module.css'`, `className={s.x}`.

- Hover → `:hover`, not `useState` + inline style.
- Conditional classes → `` `${s.btn} ${active ? s.active : ''}` ``.
- Inline `style` only for truly dynamic values.
- **Colors only via `var(--token)`, never a hardcoded hex/rgba** — the light theme overrides tokens under `:root[data-theme='light']`; a hardcoded color silently stays wrong there.
- Tokens live in `src/app/styles/global.css` (backgrounds `--bg-*`, text `--text-*`, accents `--accent-warm*`/`--accent-cool`/`--accent-rating`, borders `--border-*`, `--overlay-backdrop`, `--danger`, `--avatar-fg`, fonts `--font-*`). Read that file for the full list; a new color token goes into **both** theme blocks.
- Global utilities: `.fade-up`, `.hide-scrollbar`; keyframes `shimmer`, `pulse`, `fadeUp`.

## Icons

UI icons are React components from `@shared/ui` (`SearchIcon`, `CloseIcon`, `StarIcon`, `PlayIcon`, `ChevronLeftIcon`, …). `public/icons.svg` is a sprite with social icons only (`<use href="/icons.svg#github-icon" />`) — don't add UI icons to it.

## Accessibility baseline

Every icon-only button needs an `aria-label`. Two buttons in the same open surface must not share an accessible name (e.g. `BottomSheet`'s close is `'Dismiss'` because its backdrop is `'Close'`). **Never put user-entered text into `aria-label`/`title`/`alt`/`name`** without the treatment described in `sentry.md` — Sentry serializes those attributes into breadcrumbs and spans.

## Formatting

Formatters over API numbers/dates (`formatCurrency()`/`formatDate()`, `@entities/movie/lib`) take an optional `locale` param defaulting to `navigator.language`. Call sites never pass it; tests do, for determinism. Follow the same shape for new formatters.

## Data (summary)

Live data comes from `@entities/movie` hooks over `apiClient`; favorites/theme/profile/genre cache are `localStorage` via `createStorageSlot` (`@shared/lib`). Async data is read with Suspense `use()` inside `AsyncBoundary`; Retry wires `onRetry` to an `invalidate*` companion export. Details, caching and endpoint quirks → `.claude/rules/data-layer.md`. Check for an existing live-data hook before reaching for mock data.

Repo-wide gotchas worth knowing everywhere:

- **`useDeferredValue` over `useSearchParams()`-derived values is a silent no-op** — `setSearchParams` runs inside `startTransition`, so the deferred and live values change in the same commit. Mirror the value into `useState` from a `useEffect` first (see `useCatalogUpdateStatus.ts`).
- **`createStorageSlot().set()` returns `boolean`** (`false` on quota/private-mode failure) instead of throwing — gate side effects (analytics, "saved" UI) on it.

## Testing

Vitest config is inline in `vite.config.ts` (`jsdom`, `globals: true`, `e2e/**` excluded via `configDefaults.exclude`). API calls are mocked with **MSW** (`src/test/setup.ts`, `onUnhandledRequest: 'error'`). **Zod** validates only the `localStorage`/`sessionStorage` boundary — API responses are trusted against the generated types. Pure logic is extracted from config files (`sentry.config.ts`, `bundle.config.ts`, `sentry-telemetry.config.ts`) specifically to be unit-tested — follow that precedent instead of testing `vite.config.ts` directly.
