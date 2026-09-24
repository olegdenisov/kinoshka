---
paths:
  - 'e2e/**'
  - 'playwright.config.ts'
  - '.github/workflows/e2e.yml'
---

# E2E (Playwright + axe-core)

History: `docs/plans/completed/20260912-e2e-playwright-axe.md`.

- **Real API**, no MSW in the browser. The demo tier is 200 req/day; a full run costs ~40–50. Keep the suite small: one flow per journey, one `checkA11y` per spec. Fallback if quota breaks: `page.routeFromHAR`.
- **Build first**: `make build-only && make e2e`. `webServer` runs `vite preview --port 4173 --strictPort` over `dist/` and never builds itself (stale `dist/` must not mask regressions).
- Projects: `chromium` (`testDir: './e2e'`, ignores `**/mobile/**`) and `Mobile Safari` (`iPhone 13`, `testDir: './e2e/mobile'`). Mobile covers only `/`, `/search`, `/movie/:id` — don't widen it.
- Specs cover all 7 routes (`e2e/profile.spec.ts` is desktop-only, zero API calls).
- **Selectors:** role/label/placeholder/text only, no `data-testid`. Exception: `page.locator('a[href^="/movie/"]').first()` for "first movie card". Repeated `aria-label`s (e.g. every "Add to favorites") → scope via `.filter({ has: … })`, not CSS classes.
- `checkA11y(page)` (`e2e/utils/a11y.ts`) fails only on `impact === 'critical'`.
- Local macOS 14 can't run WebKit; validate mobile specs on Chromium with a mobile viewport. CI (ubuntu) runs WebKit.
- Specs use only Playwright APIs (no DOM lib in `tsconfig.node.json`).

## CI (`.github/workflows/e2e.yml`)

- Separate workflow (not in `ci.yml`, whose shared `pull_request` trigger would re-run every job on label events). Runs on `pull_request: [labeled]` with label **`run-e2e`**; re-run = remove and re-add the label. Fork PRs excluded; checks out `github.event.pull_request.head.sha`.
- `--shard=N/4` matrix; `concurrency` group keyed on ref **and** shard.
- `make e2e-install` runs unconditionally (browser cache doesn't cover apt deps).
- Env: `VITE_API_KEY` secret, `VITE_BASE_URL` literal. No Sentry/Plausible env — keep CI noise out of prod projects.
- Not a required check yet.
