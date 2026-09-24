---
paths:
  - 'lighthouserc.cjs'
  - 'lighthouse-config.test.ts'
  - '.github/workflows/lighthouse.yml'
  - '.github/scripts/**'
---

# Lighthouse CI

History, baseline table, verification log: `docs/plans/completed/20260915-lighthouse-ci.md`.

## Config (`lighthouserc.cjs`)

- `.cjs` because `package.json` is `"type": "module"` and `@lhci/cli` loads config with `require()`. Test reads it via `createRequire` (tsconfig can't resolve `.cjs` via `import()`).
- No `collect.url`/`startServerCommand` in the config — passed as CLI flags per context (CI: Vercel preview URL; `make lighthouse`: local `vite preview`).
- `preset: 'desktop'` (mobile throttling is flaky on shared runners). `numberOfRuns: 1` (API quota).
- `categories:performance: 'warn'` — promote to `error` **together with** making the job a required check.
- URLs: `/`, `/search`, `/movie/666` (live-verified id; if it disappears Lighthouse silently audits the error page), `/profile`.
- **SEO is asserted per-audit, not by category**: Vercel previews send `X-Robots-Tag: noindex`, which zeroes `is-crawlable` and drags the category score regardless of per-audit `off`. So: `'is-crawlable': off`, `'robots-txt': off` (its gatherer uses CDP `Network.loadNetworkResource`, which bypasses `extraHeaders` → hits Vercel SSO 302), and `error` on `document-title`, `meta-description`, `http-status-code`, `link-text`, `crawlable-anchors`, `canonical`, `hreflang`. Not listed on purpose: `viewport` (best-practices category), `image-alt` (covered by accessibility). The test locks this list.
- Deployment Protection bypass: if `process.env.VERCEL_PROTECTION_BYPASS` is non-empty, `collect.settings.extraHeaders = { 'x-vercel-protection-bypass': … }` (object, not JSON string). Header, not query param — URLs are published in the PR comment. No `x-vercel-set-bypass-cookie` (adds a redirect hop into FCP/LCP).

## Workflow (`.github/workflows/lighthouse.yml`)

- Label-triggered (`run-lighthouse`), fork PRs excluded — same pattern as `e2e.yml`.
- The bypass secret is needed in **two** places: `wait-for-vercel-preview`'s `vercel_protection_bypass_header` and the `VERCEL_PROTECTION_BYPASS` env of the LHCI step. Missing secret → 401 wall.
- Pinned: `patrickedqvist/wait-for-vercel-preview@v1.3.3` (floating `v1` is older), `treosh/lighthouse-ci-action@v12`, `actions/github-script@v8`.
- `make lighthouse` uses `pnpm dlx @lhci/cli@<pinned>` — deliberately not a devDependency (the action vendors its own).
- Comment step has `if: ${{ !cancelled() }}` so failures still get a comment.

## PR comment (`.github/scripts/lighthouse-comment.cjs`)

Pure `buildCommentBody`/`findStickyComment` + thin `run({ github, context })` called via `require()` from `actions/github-script`. Tests in `lighthouse-comment.test.mjs` (`.mjs`: Vitest is ESM-only). Table cells go through `escapeTableCell` (`|` → `\|`, newlines → `<br>`).
