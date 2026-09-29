---
paths:
  - 'vercel.json'
  - 'vercel-headers.test.ts'
  - 'index.html'
  - 'public/font-swap.js'
  - 'font-swap.test.ts'
---

# CSP, security headers, font loading

- `vercel.json` is the single source of truth: static JSON, no env substitution, every host a literal.
- Still **Report-Only**; switch to enforcing after the soak period (roadmap 2.5.4).
- `vite preview` does **not** apply these headers — neither e2e nor local Lighthouse exercises CSP.
- **Editing the anti-FOUC inline script in `index.html` changes its `script-src` hash** — the test fails until `vercel.json` is updated. An HTML minifier would break this invariant.
- `img-src`: `st.kp.yandex.net` is allowed defensively (not observed live); `image.tmdb.org` deliberately absent (`logo` isn't rendered); no `data:` — revisit if an asset crosses `assetsInlineLimit`.
- `connect-src` lists the Google Fonts hosts because Chromium checks `preconnect` hints against it.
- `require-trusted-types-for 'script'` → `dangerouslySetInnerHTML` breaks under CSP.
- Not adopted: `'strict-dynamic'` (needs per-request nonces, impossible with static headers), SRI (Google Fonts CSS is UA-negotiated, Plausible's script unversioned).
- **Manual coupling, no test:** if `VITE_BASE_URL` or the Sentry org/project/region changes, update `connect-src`/`report-uri` by hand.
- The font `media` swap script is a same-origin file, deliberately not inline — inline would need another CSP hash.
