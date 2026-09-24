---
paths:
  - 'src/main.tsx'
  - 'src/app/sentry*.ts'
  - 'src/app/router.tsx'
  - 'src/app/providers.tsx'
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

History: `docs/plans/completed/20260905-sentry-error-tracking.md`, `…/20260915-telemetry-dashboard-sentry-alerts.md`. Operational steps: `docs/telemetry-runbook.md`.

## Init

- `initSentry()` (`src/app/sentry.ts`) is a plain function; no-op unless `import.meta.env.PROD && VITE_SENTRY_DSN`.
- It's called from `src/app/sentry-bootstrap.ts`, imported as the **first line of `src/main.tsx`**. Don't reorder: `Sentry.wrapCreateBrowserRouter` silently returns the router unwrapped if `createBrowserRouter` runs before `Sentry.init()` (warning is `DEBUG_BUILD`-only). `oxfmt` doesn't reorder the side-effect import.
- Tracing: `reactRouterBrowserTracingIntegration({ useEffect, useLocation, useNavigationType, createRoutesFromChildren, matchRoutes })` (not the deprecated V7 variant) + `wrapCreateBrowserRouter` → `/movie/:id` is one transaction name. `tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE` (0.2, `sentry.config.ts`). Web Vitals (LCP/INP/CLS) come from here — not Plausible.
- `tracePropagationTargets` deliberately left at the default: the API is cross-origin and must first allow `sentry-trace`/`baggage` in CORS (runbook §4).
- `GlobalErrorBoundary` wraps `<RouterProvider>` with `Sentry.ErrorBoundary` + `ErrorState`; `shared/ui/ErrorBoundary` (behind every `AsyncBoundary`) is intentionally untouched.

## Build-time

- `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT` via `loadEnv` in `vite.config.ts`, never in the client bundle. `sentryVitePlugin` only when `command === 'build'` and all three set (`isSentryEnabled()`).
- Release `kinoshka@${version}+${gitSha}` built once in `vite.config.ts` (`buildRelease()`, version via `readFileSync(package.json)`, sha via `git rev-parse` with `'unknown'` fallback) and passed both to `define.__APP_RELEASE__` and the plugin — they must match or source maps won't resolve.
- `build.sourcemap = 'hidden'` only when the plugin is active, else `false`; `filesToDeleteAfterUpload: ['./dist/**/*.map']`. Never `true`.
- Pure logic lives in `sentry.config.ts` / `sentry.config.test.ts`.

## PII

- `sendDefaultPii: false`. `beforeSend: scrubApiKeyHeader` strips `X-API-KEY` (defense-in-depth). `VITE_API_KEY` is inlined in the bundle and source maps anyway — accepted until the BFF phase.
- **Display name in `aria-label`:** Sentry's `htmlTreeAsString` appends `[aria-label="…"]` for every element on a click path → breadcrumbs and Web-Vital spans. Defenses, in order of importance:
  1. `data-sentry-component='ProfileAvatar'` — serializer returns it before reading attributes. **The real defense.**
  2. `beforeBreadcrumb: scrubProfileNameBreadcrumb` and `beforeSendSpan: scrubProfileNameSpan` (description, string attributes, string array elements) replace everything after `PROFILE_ARIA_LABEL_PREFIX` with `[redacted]`.
- Any new element that puts user-entered text into `aria-label`/`title`/`alt`/`name` needs the same treatment.

## Telemetry-as-code (`sentry-telemetry.config.ts`, `provision-sentry-telemetry.ts`, `make sentry-telemetry`)

- Alerts: `failure_rate()` Metric Alert (`ERROR_RATE_METRIC_ALERT_CONFIG`) and `p75(measurements.lcp)` > `LCP_P75_THRESHOLD_MS` (2500), both on `transactions`, 60-min windows (low traffic → P75 over 1–2 samples is a false signal; no min-sample guard exists). Issue Alert and `count()`-based designs were rejected — see plan.
- ⚠️ **Both alert builders currently produce argv the real account rejects** (`--dataset transactions` disabled server-side, CLI 0.44.1 doesn't accept the replacement dataset, trigger payload wider than `--help`). `ERROR_ALERT_FAILURE_RATE_THRESHOLD_PERCENT = 5` is unverified. Passing unit tests ≠ works live.
- Unverified: whether a browser SPA transaction's status flips on an uncaught exception; if `failure_rate()` stays 0 in prod, switch to an explicit `count()` on `errors` and rename.
- Dashboard "Kinoshka Telemetry": 6-column grid, each row's widths sum to 6. INP/CLS widgets are placeholders (`TODO(Post-Completion)`) — those are standalone spans, dataset unconfirmed. Only LCP is alerted.
- Provisioning is **create-if-missing by name** (`shouldCreate`), not a sync: changed thresholds need manual `sentry … edit`. Widgets are added only on first dashboard creation; a mid-loop failure throws with the remaining widget names and recovery steps. Team resolved live (`sentry team list --json --fresh`). Runner is injectable (`SentryRunner`) for tests.
- argv details: `targetIdentifier` is a **string** team id (snowflake > `MAX_SAFE_INTEGER`); `buildWidgetArgs` passes `org/project`, dashboard title, widget name as **three separate tokens**.
- `.mcp.json` → Sentry MCP (`https://mcp.sentry.dev/mcp`, `type: http`); `mcp-config.test.ts` checks the URL prefix only, so local narrowing to `/org/project` is fine.
