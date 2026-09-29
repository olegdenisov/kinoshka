---
paths:
  - 'src/main.tsx'
  - 'src/app/sentry*.ts'
  - 'src/app/router.tsx'
  - 'src/app/GlobalErrorBoundary.tsx'
  - 'sentry.config.ts'
  - 'sentry-telemetry.config.ts'
  - 'provision-sentry-telemetry.ts'
  - '.mcp.json'
  - 'docs/telemetry-runbook.md'
  - 'src/features/profile/ui/ProfileAvatar/**'
  - 'src/shared/lib/profileAriaLabel.ts'
---

# Sentry: errors, tracing, telemetry-as-code

Operational steps: `docs/telemetry-runbook.md`.

## Init

- `sentry-bootstrap.ts` must stay the **first import of `main.tsx`**: `wrapCreateBrowserRouter` silently returns the router unwrapped if `createBrowserRouter` runs before `Sentry.init()`.
- Use `reactRouterBrowserTracingIntegration` (not the deprecated V7 variant) + `wrapCreateBrowserRouter` → `/movie/:id` is one transaction name. Web Vitals come from Sentry, not Plausible.
- `tracePropagationTargets` deliberately left at the default: the cross-origin API must first allow `sentry-trace`/`baggage` in CORS.
- Report caught React errors via `Sentry.captureReactException` (what `captureRouteError` does), not a hand-rolled `captureException`.
- `captureChunkLoadError` reports before `chunkPreloadRecovery` reloads — `preventDefault()` would otherwise swallow the cause.

## Build-time

- The release string is built once and passed to both `define` and the plugin — they must match or source maps won't resolve.
- `sourcemap` is `'hidden'` (uploaded, then deleted) or `false`. Never `true`.

## PII

- `VITE_API_KEY` is inlined in the bundle and source maps anyway — accepted until the BFF phase; `X-API-KEY` scrubbing is defense-in-depth.
- **User text in `aria-label`/`title`/`alt`/`name`** reaches breadcrumbs and Web-Vital spans via `htmlTreeAsString`. Defenses, by importance:
  1. `data-sentry-component` on the element — the serializer returns it before reading attributes. **The real defense; load-bearing on `ProfileAvatar`.**
  2. `beforeBreadcrumb`/`beforeSendSpan` scrubbers redacting everything after `PROFILE_ARIA_LABEL_PREFIX`.

## Telemetry-as-code

- 60-min alert windows: low traffic makes P75 over 1–2 samples a false signal.
- Passing unit tests ≠ works live — see `docs/backlog/sentry-telemetry-argv-rejected.md`.
- Provisioning is **create-if-missing by name**, not a sync: changed thresholds need a manual `sentry … edit`.
- `targetIdentifier` is a **string** (team id exceeds `MAX_SAFE_INTEGER`); `org/project`, dashboard title and widget name are **three separate argv tokens**.
