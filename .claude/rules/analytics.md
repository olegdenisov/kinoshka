---
paths:
  - 'src/shared/lib/analytics/**'
  - 'src/app/layouts/AppLayout.tsx'
  - 'src/pages/search/model/useSearchAnalytics.ts'
  - 'src/features/catalog-filter/model/useFilterState.ts'
  - 'src/features/favorites/model/useFavorites.ts'
  - 'src/vite-env.d.ts'
---

# Analytics (Plausible)

History: `docs/plans/completed/20260910-web-vitals-analytics.md`. Goal/funnel setup (manual, no API): `docs/telemetry-runbook.md`. Web Vitals moved to Sentry — don't re-add them here.

- `src/shared/lib/analytics/analytics.ts`: public `initAnalytics()`, `trackEvent(name, props?)`, `trackPageview()`. `isAnalyticsEnabled()` (`PROD && VITE_PLAUSIBLE_DOMAIN`) is exported from the module index for tests only, **not** from the `@shared/lib` barrel.
- `initAnalytics()` installs Plausible's queue stub on `window.plausible` **synchronously before** inserting the script (a dynamic `<script>` is always async — without the stub the first pageview is lost in almost every session). Duplicate insertion guarded by `id='plausible-analytics-script'`.
- Script is `script.manual.js` — no auto pageviews; `trackPageview()` is called manually.
- Event names are fixed lowercase literals (renaming Plausible goals loses history): `'pageview'`, `'search submitted'`, `'filter changed'`, `'favorite added'`. No props with user text.
- `window.plausible` is typed via `interface Window` in `src/vite-env.d.ts` — the one allowed `interface`.

## Call sites

- **pageview** — `AppLayout.tsx`, `useEffect` keyed on `location.pathname` only (not search/key — `?q` debounce and filter clicks would spam).
- **search submitted** — `src/pages/search/model/useSearchAnalytics.ts`: no discrete submit exists, so it debounces the committed `?q` by 800ms and compares to the last tracked value in a ref; ref resets on empty query.
- **filter changed** — `applyFilters` in `useFilterState.ts`, the single commit point; fires even on no-op commits (accepted). `setSort` is not tracked.
- **favorite added** — add-branch of `toggle(id)` in `useFavorites.ts`, only if the storage write succeeded (`if (setIds(...)) trackEvent(...)`). `add(id)` has no UI caller and isn't instrumented.
