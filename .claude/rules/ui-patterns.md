---
paths:
  - 'src/entities/movie/ui/**'
  - 'src/features/catalog-filter/ui/YearRangeSlider/**'
  - 'src/features/theme/**'
  - 'src/app/styles/**'
---

# UI patterns

## `Card`

- **Stretched link:** no interactive elements inside `<a>`. The `<Link>` wraps only the title and its `::after` stretches the hit area; action buttons are DOM **siblings** with a higher `z-index`. Use this for any card with a primary link + secondary actions.
- `.topBadges` stays at implicit `z-index: auto` — an explicit `z-index: 1` ties with `.title::after` inside the `isolation: isolate` context and, by DOM order, creates a dead click zone. New overlay badges: check which corner is free and whether they must out-stack the stretched link.
- The title `<Link>` must always have text: Lighthouse `link-name` is part of the a11y gate (≥0.95) and the demo API can return a movie with an empty `name`. `mapDocToMovie` falls through empty strings (`||`), `Card` shows `Untitled` as the last resort.
- `.actions` (incl. the watchlist `Add`) is hidden on `hover: none` — an action that must work on touch needs another entry point (today: the movie page).

## `YearRangeSlider`

- Commit only if the pair differs from the last commit — Tab focus alone fires `keyup`.
- Clamp incoming values (initial state and prop resync) — out-of-range or `from > to` desyncs React's controlled value from the DOM.

## Theming

- `toggleTheme()` always writes an explicit `light`/`dark` (replaces `system`); the header toggle and `/profile` share one `themeSlot` — deliberate.
- `contrast.test.ts` guards light-theme token contrast (`--accent-warm-soft` passes barely, ~4.52:1). `--avatar-fg` over the avatar gradient is **not** covered by any tool — see `profile.md`.
