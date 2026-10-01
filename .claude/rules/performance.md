---
paths:
  - 'src/widgets/movie-rail/**'
  - 'src/pages/movie/ui/RelatedMovies/**'
  - 'src/shared/lib/inView/**'
  - 'src/entities/movie/ui/Poster/**'
  - 'src/pages/movie/ui/MovieHero/**'
---

# Performance: rails, lazy-mount, images

## No virtualization for home rails

- Rails are **not** virtualized: the demo API tier caps a rail at ≤10 cards, and virtualization conflicts with the hover-arrow `scrollBy` in `MovieRail`.
- The ≤10 ceiling is an **external fact** for 3 of 4 rails (they pass no `limit`). Revisit if the API tier changes or an explicit `limit` is added.
- `/search` stays on numbered pagination, so grid virtualization doesn't apply until it moves to infinite scroll.

## `content-visibility: auto`

- Set on **both** the rail and its skeleton — the skeleton is what Lighthouse sees during the measured window.
- `contain-intrinsic-size` heights are measured by hand (the skeleton's is derived from its CSS). Re-measure whenever a rail layout changes, otherwise scroll height jumps (CLS).
- Paint containment clips focus outlines outside the padding box — keep the 2px padding/negative-margin compensation on the desktop rail section.
- Safari < 18 falls back to normal rendering — accepted.

## `useInView()` lazy-mount

- `content-visibility` for purely visual offscreen content; `useInView` when the React tree itself must not mount (render cost, subscriptions).
- Reserve space with placeholders reusing the real grid classes and `aspect-ratio`, not a fixed `min-height` — the grid is fluid. Safe only while nothing renders below `RelatedMovies`.

## Images

- Below-the-fold images are `loading='lazy'`; home rail cards stay lazy even in the first viewport (in-viewport lazy images are fetched immediately, `/` LCP unaffected).
- **Never lazy-load an LCP candidate** (`PersonHero` photo, `MovieHero` poster via `<Poster eager />`). The `MovieHero` backdrop is a gradient only (no photo), so it is not an LCP candidate; the `fetchPriority` question for the poster is open — re-check with Lighthouse before adding it.
