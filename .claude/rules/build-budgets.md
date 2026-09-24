---
paths:
  - 'vite.config.ts'
  - 'bundle.config.ts'
  - 'package.json'
  - 'knip.jsonc'
  - 'src/app/router.tsx'
  - 'src/app/layouts/AppLayout.tsx'
  - 'src/shared/lib/lazyNamed/**'
---

# Code splitting, size budgets, knip

History and measurements: `docs/plans/completed/20260912-performance-budgets-bundle-visualization.md`.

## Code splitting

- Every route is `lazyNamed(() => import('../pages/x'), 'XPage')` (`@shared/lib`) — `React.lazy` needs a default export, pages export by name.
- `<Suspense fallback={<Spinner/>}>` around `<Outlet/>` in `AppLayout` is for **code** loading; pages keep their own `AsyncBoundary` for data. Accepted: navigations run in `startTransition`, so on page-to-page nav the old page (and nav highlight, pageview) stays until the chunk loads.
- `build.rolldownOptions.output.codeSplitting.groups` (not deprecated `advancedChunks`, no global `chunkFileNames`): `vendor` (`/node_modules/`), `shared` (`/(widgets|features|entities|shared)\//`), then one `page-<name>` group per page. **`shared` must precede the page groups** — without it Rolldown dumps cross-page code into the first page chunk and every route eagerly loads it. Verify after changes: entry and page chunks import only `rolldown-runtime`/`vendor`/`shared`, never another `page-*`.
- New route → add a `page-<name>` group and a `size-limit` entry.

## `size-limit` (`package.json`, `@size-limit/file`, `gzip: true`, `path` globs)

- Entries: `entry`, `vendor`, `shared`, one per `page-*`. Limit = **measured gzip size + 15%**, derived from a real build, not guessed. Current numbers are in `package.json` — that's the source of truth.
- `@size-limit/file`, not `preset-app` (which pulls headless Chrome for timing).
- `entry` measured without `VITE_SENTRY_DSN` is smaller (Sentry setup is dead-code-eliminated). Re-derive its limit with a DSN set: `VITE_SENTRY_DSN=https://k@o1.ingest.sentry.io/1 make build-only && make size`.
- Not budgeted on purpose: `rolldown-runtime-*.js`, all CSS chunks.

## `make analyze`

`isAnalyzeEnabled({ command, env })` (`bundle.config.ts`, tested) gates `rollup-plugin-visualizer` → `dist/stats.html` (treemap, gzip + brotli). Off in normal builds.

## knip (`knip.jsonc` — `.jsonc` so ignores can carry comments)

- `entry`: `src/main.tsx`, `**/*.test.{ts,tsx}`, root configs, `playwright.config.ts`, `e2e/**/*.spec.ts`; `e2e/**/*.ts` in `project`.
- `ignore` only intentional keepers: `src/shared/api/*.gen.ts`, `@shared/config` (unused feature flags), public barrels of `catalog-filter`/`favorites`/`theme`/`shared/ui`.
- Anything else knip flags → fix at the source (delete file / drop `export`), don't add an ignore.

## Vitest

`test.exclude: [...configDefaults.exclude, 'e2e/**']` — otherwise Vitest picks up Playwright specs.
