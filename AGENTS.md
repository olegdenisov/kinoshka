# AGENTS.md

This file provides guidance when working with code in this repository.

Kinoshka — movie catalog SPA with a home feed, search, filters, and detail pages (overview, cast, media).

## Topic docs — read before touching these areas

This file holds only repo-wide conventions. Area-specific decisions and gotchas live in `.claude/rules/*.md`. Claude Code loads them automatically via their `paths:` frontmatter (the source of truth for which files a rule covers); **other agents (Codex, etc.) must check that frontmatter (`head -15 .claude/rules/*.md`) and open the matching file by hand before editing files in that area.** Background and history live in `docs/plans/completed/*.md`.

| Doc                 | Topic                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `data-layer.md`     | fetch caching, `AsyncBoundary`/Retry, endpoint quirks, id-list fetching   |
| `search-catalog.md` | `/search` URL state, text-vs-filter modes, genres                         |
| `storage.md`        | `createStorageSlot` semantics and failure handling                        |
| `user-lists.md`     | Watched/Watchlist: independence, relation to Favorites                    |
| `profile.md`        | `/profile`, avatar contrast, `BottomNav`                                  |
| `ui-patterns.md`    | `Card` stacking/stretched link, `YearRangeSlider`, theming, contrast test |
| `performance.md`    | rails, `content-visibility`, lazy-mount, image loading                    |
| `sentry.md`         | init order, tracing, PII scrubbing, telemetry-as-code                     |
| `analytics.md`      | Plausible init and event rules                                            |
| `build-budgets.md`  | code splitting, chunk-error recovery, `size-limit`, knip                  |
| `csp.md`            | security headers, CSP hash invariant, font loading                        |
| `e2e.md`            | Playwright against the live API, quota, selectors                         |
| `lighthouse.md`     | Lighthouse CI config, SEO asserts, Vercel bypass                          |

When a new area-specific decision is worth recording, add it to the matching rule file — not here. Record the rule and the one-line reason; the story of how it was found belongs in the plan.

- **Only what the code can't tell you:** a decision and its reason, a non-obvious constraint, a trap. Never retell the code — hook signatures, file lists, route chrome, "page X is a copy of page Y", exact numbers, e2e step lists, what a test checks. They go stale and duplicate what reading the code already gives. A WHY-comment at the single place the rule applies counts as code — prefer it over a rule entry.
- **One invariant, one place.** If two rule files would say the same thing, pick one and let the other point to it.
- **Put it where it will load:** pick the file whose `paths:` matches the code an agent will be editing when the rule matters, not the file of the feature that motivated it (a `Card` caveat goes to `ui-patterns.md` even if found while building watchlist).
- **A new rule file is the exception, not a default step of a feature plan.** Create one (with `paths:` frontmatter and a row in this table) only when the decisions don't fit any existing file; a new page or feature by itself is not a reason. A feature that adds nothing non-obvious gets no rule-doc update at all.

## Git workflow

`main` is protected — changes land only via pull request, never a direct push. Work on a branch and open a PR to merge into `main`.

## Commands

A `Makefile` at the project root wraps all pnpm scripts. Prefer `make` over direct `pnpm` calls.

```bash
make check        # format-check lint build (full validation)
make typecheck    # tsc -b — without -b the solution-style tsconfig checks 0 files
make test         # Vitest once
make build-only   # Vite production build, no type-check
make e2e          # Playwright E2E (requires make build-only first)
make size         # size-limit budgets against dist/
make knip         # unused exports/deps/files
make generate-api # regenerate API client (re-run after spec changes)
```

The rest (`dev`, `format`, `coverage`, `analyze`, `lighthouse`, `sentry-telemetry`, …) is in the `Makefile`.

**Commit hooks:** husky + lint-staged run `oxfmt` + `oxlint --fix --deny-warnings` on staged `*.{ts,tsx}` and `stylelint` on staged `*.module.css`. Commit messages are enforced by commitlint (`@commitlint/config-conventional`); use `pnpm commit` (commitizen) for a guided conventional-commit prompt. The lint-staged glob doesn't cover `.cjs`/`.js` (`lighthouserc.cjs`, `public/font-swap.js`) — those are only checked by repo-wide `make lint`/`make format-check`.

## Architecture

React 19 + TypeScript 7 + Vite 8 (Rolldown) single-page app.

- **React Compiler is enabled** (`babel-plugin-react-compiler` via `@rolldown/plugin-babel`). Don't write manual `useMemo` / `useCallback` / `memo`.
- **TypeScript strictness:** `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` (no `enum`, `namespace`, parameter properties).
- **TypeScript style:** `type`, not `interface` — enforced by oxlint `typescript/consistent-type-definitions`. Single exception: `interface Window` in `src/vite-env.d.ts` (global declaration merging only works through `interface`), marked with `oxlint-disable-next-line`.
- **Fonts:** Instrument Serif (`--font-serif`), Instrument Sans (`--font-display`/`--font-body`), JetBrains Mono (`--font-mono`), loaded in `index.html` (async-load details → `csp.md`). Don't add new font imports.
- **Path aliases** map to FSD layers (`vite.config.ts` + `tsconfig.app.json`): `@app`, `@pages`, `@widgets`, `@features`, `@entities`, `@shared`. Use them for all cross-layer imports.

## Project structure

[Feature-Sliced Design](https://feature-sliced.design/):

```
src/
├── app/          # providers, router, layouts, global styles, sentry bootstrap
├── pages/        # route-level components
├── widgets/      # large reusable UI sections (header, mobile-chrome, movie-rail, search-sidebar)
├── features/     # user-facing interactive features (catalog-filter, favorites, watched, watchlist, theme, profile, recommendations)
├── entities/     # business-domain objects (movie, person — types, api, hooks, UI)
└── shared/       # cross-cutting utilities and primitives (api/, lib/, ui/, config/)
```

Import direction: `pages → widgets → features → entities → shared`. Never import upward. Enforced for `@`-alias imports by `no-restricted-imports` overrides in `.oxlintrc.json` (relative `../` imports across layers aren't caught — don't write them). A generic component needed by both a widget and a feature goes to `@shared/ui` (that's why `IconButton`/`AvatarCircle` live there).

**Public API:** every slice in `widgets/` and `features/` (and every `entities/*` slice) exposes an `index.ts`. Import only through it — `import { Header } from '@widgets/header'`, never `@widgets/header/ui/Header` (lint error). Same for `@shared/{ui,lib,api,config}`. The barrel `index.ts` is the source of truth for what a slice exports — read it before adding a new hook; an equivalent may already exist.

**Page-slice `model/` facade.** When a page needs to combine more than one downward slice (e.g. `@features/*` + `@entities/*`), put the composing hook in `src/pages/<page>/model/` — a lower slice can't import a higher one. Page-internal, not exported. Examples: `useMovieCatalog`, `useRecommendedMovies`, `useSearchAnalytics`.

## Routing

React Router 7. Route config: `src/app/router.tsx` (every route lazy via `lazyNamed`, router wrapped with `Sentry.wrapCreateBrowserRouter`); providers: `src/app/providers.tsx`; chrome/layout: `src/app/layouts/AppLayout.tsx`.

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
- **Colors only via `var(--token)`, never a literal color** — the light theme overrides tokens under `:root[data-theme='light']`; a hardcoded color silently stays wrong there. Enforced by stylelint (`stylelint.config.mjs`: `color-no-hex`, `color-named`, `rgb()`/`oklch()`/… disallowed) on `*.module.css`; `global.css` is exempt because it defines the tokens. A genuinely theme-independent color (scrim over a photo, mask alpha) gets a `stylelint-disable` comment with the reason.
- Tokens live in `src/app/styles/global.css` (backgrounds `--bg-*`, text `--text-*`, accents `--accent-warm*`/`--accent-cool`/`--accent-rating`, borders `--border-*`, `--overlay-backdrop`, `--danger`, `--avatar-fg`, fonts `--font-*`). Read that file for the full list; a new color token goes into **both** theme blocks.
- Global utilities: `.fade-up`, `.hide-scrollbar`; keyframes `shimmer`, `pulse`, `fadeUp`.

## Icons

UI icons are React components from `@shared/ui` (`SearchIcon`, `CloseIcon`, `StarIcon`, `PlayIcon`, `ChevronLeftIcon`, …). `public/icons.svg` is a sprite with social icons only (`<use href="/icons.svg#github-icon" />`) — don't add UI icons to it.

## Accessibility baseline

Every icon-only button needs an `aria-label`. Two buttons in the same open surface must not share an accessible name (e.g. `BottomSheet`'s close is `'Dismiss'` because its backdrop is `'Close'`). **Never put user-entered text into `aria-label`/`title`/`alt`/`name`** without the treatment described in `sentry.md` — Sentry serializes those attributes into breadcrumbs and spans.

## Formatting

Formatters over API numbers/dates (`formatCurrency()`/`formatDate()`, `@entities/movie/lib`) take an optional `locale` param defaulting to `navigator.language`. Call sites never pass it; tests do, for determinism. Follow the same shape for new formatters.

## Data (summary)

Async data is read with Suspense `use()` inside `AsyncBoundary`; client state lives in `localStorage` via `createStorageSlot`. Details → `data-layer.md`, `storage.md`. Check for an existing live-data hook before reaching for mock data.

Repo-wide gotchas worth knowing everywhere:

- **`useDeferredValue` over `useSearchParams()`-derived values is a silent no-op** — `setSearchParams` runs inside `startTransition`, so the deferred and live values change in the same commit. Mirror the value into `useState` from a `useEffect` first (see `useCatalogUpdateStatus.ts`).
- **`createStorageSlot().set()` returns `boolean`** (`false` on quota/private-mode failure) instead of throwing — gate side effects (analytics, "saved" UI) on it.

## Testing

Vitest config is inline in `vite.config.ts` (`jsdom`, `globals: true`, `e2e/**` excluded via `configDefaults.exclude`). API calls are mocked with **MSW** (`src/test/setup.ts`, `onUnhandledRequest: 'error'`). **Zod** validates only the `localStorage`/`sessionStorage` boundary — API responses are trusted against the generated types. Pure logic is extracted from config files (`sentry.config.ts`, `bundle.config.ts`, `sentry-telemetry.config.ts`) specifically to be unit-tested — follow that precedent instead of testing `vite.config.ts` directly.
