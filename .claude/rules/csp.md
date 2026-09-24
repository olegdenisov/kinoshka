---
paths:
  - 'vercel.json'
  - 'vercel-headers.test.ts'
  - 'index.html'
  - 'public/font-swap.js'
  - 'font-swap.test.ts'
---

# CSP, security headers, font loading

History (incl. how hosts were verified): `docs/plans/completed/20260912-csp-security-headers.md`.

## Headers (`vercel.json` — single source of truth)

- `source: "/(.*)"`: `Content-Security-Policy-Report-Only`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`. Static JSON — no env substitution, every host is a literal.
- Still **Report-Only**; switch to enforcing after the soak period (roadmap 2.5.4).
- `vercel-headers.test.ts` parses `vercel.json` directly (no duplicated `csp.config.ts`).
- `vite preview` does **not** apply these headers — neither e2e nor local Lighthouse exercises CSP.

## Directives

- `script-src`: a `'sha256-…'` of the anti-FOUC inline script in `index.html` + `'unsafe-inline'` (ignored by CSP2+ browsers when a hash is present; legacy fallback) + `https://plausible.io`. **Editing the inline script changes the hash** — `vercel-headers.test.ts` recomputes it from `index.html` and fails if `vercel.json` is stale. Vite doesn't transform that tag; an HTML minifier would break the invariant.
- `style-src 'unsafe-inline'` — runtime inline `style` attributes can't be hashed; accepted (CSS injection only).
- `img-src`: `https://avatars.mds.yandex.net` (posters/backdrops/images) and `https://st.kp.yandex.net` (person photos). `image.tmdb.org` deliberately absent (`logo` isn't rendered). No `data:` — no asset currently crosses `assetsInlineLimit`; revisit if one does.
- `connect-src` includes `fonts.googleapis.com`/`fonts.gstatic.com` because Chromium checks `preconnect` hints against `connect-src`.
- `require-trusted-types-for 'script'` (no `dangerouslySetInnerHTML` in `src/`).
- `'strict-dynamic'` not adopted — needs per-request nonces, impossible with static `vercel.json` (revisit with Edge Middleware/SSR).
- `report-uri` = Sentry security endpoint built from the public DSN key. No `report-to`.
- No SRI: Google Fonts CSS is UA-negotiated, Plausible's script is unversioned.
- **Manual coupling, no test:** if `VITE_BASE_URL` or the Sentry org/project/region changes, update `connect-src`/`report-uri` by hand.

## Font loading (`index.html` + `public/font-swap.js`)

Google Fonts `<link id="gfonts-stylesheet" media="print">` swapped to `media="all"` on load by `public/font-swap.js` (same-origin `defer` script, deliberately not inline — inline would need another CSP hash), plus a `<noscript>` fallback. `font-swap.test.ts` runs the script via `node:vm` and asserts the `id` in `index.html` matches the one the script looks up.
