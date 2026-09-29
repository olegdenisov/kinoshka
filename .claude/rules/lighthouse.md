---
paths:
  - 'lighthouserc.cjs'
  - 'lighthouse-config.test.ts'
  - '.github/workflows/lighthouse.yml'
  - '.github/scripts/**'
---

# Lighthouse CI

- Config is `.cjs`: `@lhci/cli` loads it with `require()` and `package.json` is `"type": "module"`.
- `preset: 'desktop'` (mobile throttling is flaky on shared runners), `numberOfRuns: 1` (API quota).
- `categories:performance` is `warn` — promote to `error` **together with** making the job a required check.
- `/movie/666` is a live-verified id; if it disappears, Lighthouse silently audits the error page.
- **SEO is asserted per audit, not by category:** Vercel previews send `X-Robots-Tag: noindex`, which drags the category score regardless. `robots-txt` is off because its gatherer bypasses `extraHeaders` and hits the Vercel SSO redirect.
- Deployment Protection bypass goes in a header, not a query param — URLs are published in the PR comment. No `x-vercel-set-bypass-cookie` (adds a redirect hop into FCP/LCP).
- The bypass secret is needed in **two** places (wait-for-preview step and the LHCI step env); missing → 401 wall.
- Comment-script tests are `.mjs` because Vitest is ESM-only.
