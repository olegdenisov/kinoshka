---
paths:
  - 'e2e/**'
  - 'playwright.config.ts'
  - '.github/workflows/e2e.yml'
---

# E2E (Playwright + axe-core)

- **Real API**, no MSW in the browser; a full run costs ~40–50 of the 200 req/day. Keep the suite small: one flow per journey, one `checkA11y` per spec. Fallback if quota breaks: `page.routeFromHAR`.
- **Build first** (`make build-only && make e2e`): `webServer` never builds, so a stale `dist/` must not mask regressions.
- Mobile project covers only `/`, `/search`, `/movie/:id` — don't widen it.
- **Selectors:** role/label/placeholder/text only, no `data-testid`. Exceptions: `a[href^="/movie/"]` / `a[href^="/person/"]` for "first card". Repeated `aria-label`s → scope via `.filter({ has: … })`, not CSS classes.
- Local macOS 14 can't run WebKit — validate mobile specs on Chromium with a mobile viewport; CI runs WebKit.
- Specs use only Playwright APIs (no DOM lib in `tsconfig.node.json`).
- CI is a separate label-triggered workflow (`run-e2e`), not part of `ci.yml` — its shared `pull_request` trigger would re-run every job on label events. No Sentry/Plausible env in CI — keeps noise out of prod projects.
