---
paths:
  - 'src/shared/lib/analytics/**'
  - 'src/pages/search/model/useSearchAnalytics.ts'
  - 'src/features/catalog-filter/model/useFilterState.ts'
  - 'src/features/favorites/model/favorites.ts'
---

# Analytics (Plausible)

Goal/funnel setup (manual): `docs/telemetry-runbook.md`. Web Vitals live in Sentry — don't re-add them here.

- `isAnalyticsEnabled()` is exported for tests only, **not** from the `@shared/lib` barrel.
- The `window.plausible` queue stub must be installed **before** the async script is inserted, otherwise the first pageview is lost; `script.manual.js` → pageviews are sent manually.
- Event names are fixed lowercase literals — renaming a Plausible goal loses its history. No props with user text.
- `filter changed` fires even on no-op commits (accepted); `setSort` is not tracked.
- `favorite added` fires on every add regardless of the storage write: Reatom persist swallows `setItem` failures, so there is no success signal.
