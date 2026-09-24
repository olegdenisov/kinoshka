---
paths:
  - 'src/entities/movie/ui/**'
  - 'src/features/catalog-filter/ui/YearRangeSlider/**'
  - 'src/features/theme/**'
  - 'src/app/styles/**'
  - 'index.html'
---

# UI patterns

## Stretched link (`Card`)

No interactive elements nested inside `<a>`. The card container is a plain `<div>` with `position: relative`; the `<Link>` wraps only the title (real accessible name) and its `::after` (`position: absolute; inset: 0`) stretches the hit area over the card. Action buttons are DOM **siblings** of the link with a higher `z-index`. Use this for any future card with a primary link + secondary actions.

## `rankBadge` slot in `Card`

`rankBadge?: ReactNode` (rendered by `PopularBadge`) sits with `.ratingBadge` in `.topBadges`, top-left, on all breakpoints. `.topBadges` stays at implicit `z-index: auto` — an explicit `z-index: 1` would tie with `.title::after` inside the `isolation: isolate` context and, by DOM order, create a dead click zone. The bottom corners are taken by `.favoriteBtn` and the hover-only `.actions` row. New overlay badges: check which corner is free and whether they must out-stack the stretched link.

## Dual-thumb range (`YearRangeSlider`)

- Two overlapping native `<input type="range">` (free keyboard/focus/SR support), no custom pointer-drag.
- Cross-link `min`/`max` (from's `max` = live `to`, and vice versa) so the browser prevents crossing.
- `pointer-events: none` on inputs, `auto` on `::-webkit-slider-thumb`/`::-moz-range-thumb`; native track transparent, visible track/fill are absolutely-positioned divs with inline `%` styles.
- Commit on `onMouseUp`/`onTouchEnd` **and** `onKeyUp`, only if the pair differs from the last commit (Tab focus alone fires `keyup`).
- Clamp/normalize incoming values (initial state and props-resync) — out-of-range or `from > to` desyncs React's controlled value from the DOM.

## Theming (`@features/theme`)

- `light`/`dark`/`system` resolved to `light`/`dark` and applied as `data-theme` on `<html>`.
- `global.css`: unconditional `:root` = dark; `:root[data-theme='light']` overrides the same variables. Each block also sets `color-scheme` so native controls match.
- Inline `<script>` in `index.html` `<head>` sets `data-theme` before first paint (anti-FOUC). Editing it changes its CSP hash → see `csp.md`.
- Header `ThemeToggle` calls `toggleTheme()` (always explicit `light`/`dark`, replaces `system`); `/profile` radio group uses `setTheme`. Both share one `themeSlot` — deliberate, tested.
- `IconButton` lives in `@shared/ui` because `features/theme` renders it and features can't import widgets.

## Contrast guarded by tests

`src/app/styles/contrast.test.ts` recomputes WCAG contrast for light-theme tokens parsed from `global.css` (`--text-faint`, `--accent-warm` incl. the translucent `--accent-warm-soft` composited over `--bg-secondary` — ~4.52:1, barely passing; `--danger`). Changing these tokens must keep the test green. `--avatar-fg` over the avatar gradient is **not** covered by any tool (axe can't compute contrast through gradients) — see `profile.md`.
