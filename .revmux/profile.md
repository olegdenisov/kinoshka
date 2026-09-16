# Kinoshka — revmux review profile

## What this software is

React 19 + TypeScript 7 + Vite 8 single-page movie catalog app (Feature-Sliced Design:
`app → pages → widgets → features → entities → shared`, strict downward-only imports).
Client-only SPA calling a third-party Kinopoisk API through a generated client
(`@siberiacancode/apicraft`); no backend of its own yet (BFF is a future phase). Ships to
production as a static build (Vite), with Sentry error tracking wired for prod builds only.

## What a real failure looks like here

- **Runtime crash / blank screen for a user**: unhandled exception outside any `ErrorBoundary`/
  `AsyncBoundary`, a Suspense boundary that never resolves, an infinite re-render loop (this repo
  has hit this exact bug before via a `useSyncExternalStore` snapshot that wasn't referentially
  stable — see `createStorageSlot.get()` history).
- **Data integrity in localStorage/sessionStorage**: favorites, theme, genre-dictionary cache, and
  session-persisted catalog cache are all read back through Zod validation at that boundary
  specifically because they're the one place this app trusts external/mutable state. A missing or
  broken validation there is a real finding. API responses themselves are NOT Zod-validated
  (trusted against generated OpenAPI types) — flagging that as "missing validation" is a false
  positive; only the storage boundary is in scope for that kind of finding.
- **Secret/PII leakage**: `VITE_API_KEY` is deliberately inlined into the client bundle (accepted,
  documented limitation until a BFF exists) — do not flag this as a vulnerability. The one real
  scrubbing concern is `X-API-KEY`/`x-api-key` leaking into Sentry events via `beforeSend
(scrubApiKeyHeader)`, and source maps (`sourcemap: 'hidden'`) never being published to `dist/`
  even though they contain that inlined key.
- **Broken FSD import direction**: any import that goes "upward" (e.g. `entities/` importing from
  `features/` or `widgets/`) is a real architectural defect, not a style nit — it's enforced by
  path aliases and is a hard rule, not a preference.
- **React Compiler assumptions violated**: manual `useMemo`/`useCallback`/`memo` are not wrong per
  se, but are almost always dead weight here since `babel-plugin-react-compiler` handles
  memoization automatically — flag them as a `minor` simplification opportunity, not silently
  approve them as "extra safety."
- **Broken responsive contract**: this app uses ONE component + one CSS module per page/widget,
  mobile-first, with desktop overrides in `@media (min-width: 720px)`. A new component that forks
  on `useViewport().isMobile` in JS instead of expressing the difference in CSS is a real
  regression against an established migration (see `docs/plans/completed/20260827-*`), UNLESS it's
  one of the two documented, deliberate JS forks (`AppLayout`'s chrome-variant mount decision,
  `Search`'s sidebar-vs-bottom-sheet UX pattern) — don't flag those two as violations.

## Blast radius

- `src/shared/**` and `src/app/**` (providers, router, global styles, Sentry init) are the highest
  blast-radius layers — a bug here affects every page.
- `src/entities/movie/**` is the next tier — most pages read data through its hooks
  (`useNewMovies`, `useMovieDetail`, `usePopularMovies`, etc.) and its `createCachedFetcher`/
  `createSessionCache` caching layer; a caching bug here (stale reads, wrong invalidation, cache
  key collisions) silently serves wrong data across the whole app, not just one page.
- `src/pages/<page>/model/*.ts` "page-slice facade" hooks (`useMovieCatalog`, `useRecommendedMovies`,
  `usePageSync`) are deliberately allowed to import both `@features/*` and `@entities/*` downward —
  this is NOT an FSD violation, it's the documented escape hatch for cross-slice composition. Don't
  flag these files for "importing from two different lower layers."
- Generated files (`src/shared/api/instance.gen.ts`, `types.gen.ts`) are out of scope entirely —
  they're regenerated from an OpenAPI spec via `make generate-api` and carry `// @ts-nocheck`; any
  finding inside them is not actionable by a code change here.

## Reporting bar

- This is a small, fast-moving hobby/portfolio-scale SPA, not a high-traffic production service.
  Do not raise concurrency/race-condition findings that assume multi-instance/multi-process
  deployment (there is none) or backend-style load concerns (there is no backend).
- `minor` findings about missing tests are only worth raising for new logic (hooks, pure functions,
  non-trivial component behavior) — this repo's own convention (see AGENTS.md "Testing") is
  Vitest + MSW + Testing Library, `globals: true`, with Zod validated only at the storage boundary.
  A missing test for a pure CSS/layout change is not worth flagging.
- `pnpm exec tsc -b` is the only real type-check gate (root `tsconfig.json` used by `make
typecheck` was previously a no-op checking 0 files — this was fixed as of the Sentry
  error-tracking work, see `docs/plans/completed/20260905-*`). If reviewing an older diff/commit
  predating that fix, don't assume `make typecheck`/CI green means types are actually checked —
  verify with `tsc -b` yourself before trusting a "type-safe" claim in that range.

## Deliberate conventions (do not flag as violations)

- `type` over `interface` everywhere; no `enum`/`namespace`/parameter properties
  (`erasableSyntaxOnly` is on).
- No manual `useMemo`/`useCallback`/`memo` — React Compiler handles it (still fine to flag if one
  is clearly redundant/dead, but don't demand adding one).
- `Card`'s stretched-link pattern: outer `<div>` (not `<a>`), `Link` wraps only the title with a
  `::after` full-card overlay, action buttons as z-indexed siblings — this is intentional a11y/HTML
  validity work, not a bug.
- `YearRangeSlider`'s two overlapping native `<input type="range">` elements with cross-linked
  min/max — intentional, not a hand-rolled-drag anti-pattern waiting to happen.
- `IconButton` living in `@shared/ui` rather than `@widgets/header` — intentional, driven by FSD
  import direction (features/* can't import widgets/*).
- Flat files in `src/app/` (`GlobalErrorBoundary.tsx`, `providers.tsx`, `router.tsx`) without a
  per-component directory — deliberate departure from the "one directory per component" rule that
  applies to `widgets/`/`features/`, not to `app/`.
- Root-level `<tool>.config.ts` files (`vite.config.ts`, `apicraft.config.ts`, `sentry.config.ts`)
  are Node-context build tooling, not FSD app code — don't apply FSD layering rules to them.
- `useDeferredValue` over `useSearchParams()`-derived state requires mirroring through a
  `useEffect` + local `useState` first, because `setSearchParams` navigates inside
  `React.startTransition` — a `useDeferredValue` called directly on a URL-derived value is a
  documented, known gotcha in this codebase (`useCatalogUpdateStatus.ts`), not something every new
  usage needs to be warned about again if it already follows this pattern.
- Accepted/known limitations, not regressions to fix: `VITE_API_KEY` inlined into the client bundle
  (pre-BFF); `MovieInListDto` (from `/list` endpoints) lacking `type`/`genres`, defaulting to
  `'movie'`/`[]`; no reverse RU→EN mapping on displayed genre names from search results;
  `recommendations` feature flag (`FeatureName.recommendations`) intentionally left `false` with no
  consumer wiring it up.
