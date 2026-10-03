---
paths:
  - 'vite.config.ts'
  - 'bundle.config.ts'
  - 'package.json'
  - 'knip.jsonc'
  - 'src/app/routes.tsx'
  - 'src/app/chunkPreloadRecovery.ts'
  - 'src/shared/lib/lazyNamed/**'
---

# Code splitting, size budgets, knip

## Code splitting

- The route-level `<Suspense>` around the outlet is for **code** loading only; data states are rendered by pages via `AsyncContent`.
- `chunkPreloadRecovery` reloads the page on `vite:preloadError`: `React.lazy` caches a rejected import, so neither a boundary retry nor navigation recovers — a full reload is the only guaranteed fix. The anti-loop window logic and its scenario matrix are in the file.
- `lazyNamed` turns the `undefined` that `preventDefault()` makes Vite resolve into a never-settling promise (spinner until reload) instead of a misleading `TypeError` — keep that branch.
- **`shared` must precede the page groups in `codeSplitting.groups`** — otherwise Rolldown dumps cross-page code into the first page chunk. Verify after changes: entry and page chunks import only `rolldown-runtime`/`vendor`/`shared`, never another `page-*`.

## `size-limit`

- Limit = **measured gzip + 15%** from a real build, never guessed.
- Measure `entry` **with** `VITE_SENTRY_DSN` set (`VITE_SENTRY_DSN=https://k@o1.ingest.sentry.io/1 make build-only && make size`) — without it Sentry setup is eliminated and the number is too small. `entry` has little headroom: a feature that adds a storage slot or hook there needs the limit re-derived.
- `@size-limit/file`, not `preset-app` (pulls headless Chrome).
- Not budgeted on purpose: `rolldown-runtime-*.js`, CSS chunks.

## knip

- `ignore` only for intentional keepers (reasons are in `knip.jsonc`). Anything else knip flags → fix at the source, don't add an ignore.
