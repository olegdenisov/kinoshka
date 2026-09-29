---
paths:
  - 'src/widgets/movie-rail/**'
  - 'src/pages/movie/ui/RelatedMovies/**'
  - 'src/shared/lib/inView/**'
  - 'src/test/setup.ts'
  - 'src/entities/movie/ui/Poster/**'
  - 'src/pages/movie/ui/MovieHero/**'
---

# Performance: rails, lazy-mount, images

History and Lighthouse before/after numbers: `docs/plans/completed/20260916-performance-virtualization-lazy-loading.md`.

## No virtualization for home rails

- Home rails are **not** virtualized (`@tanstack/react-virtual`/`react-window`): the demo API tier caps a rail at ≤10 cards, and a list that short gains nothing while virtualization conflicts with the hover-arrow `scrollBy(480px)` in `MovieRail`.
- The ≤10 ceiling is an **external fact, not readable from code** for 3 of 4 rails (`useNewMovies`/`useTopRatedMovies` pass no `limit` to `getMovies.ts`; only `usePopularMovies` sets `limit: 10`). Revisit if the API tier changes or an explicit `limit` is added to `getMovies.ts`.
- `/search` stays on numbered pagination (`MAX_PAGE = 10`), so grid virtualization does not apply until it moves to infinite scroll.

## `content-visibility: auto`

- Set on `.section` in **both** `MovieRail.module.css` and `MovieRailSkeleton.module.css` — the skeleton is what Lighthouse actually sees during the measured window, so optimizing only the loaded state has no effect.
- `contain-intrinsic-size: auto <px>` holds approximate heights: `MovieRail` was measured in DevTools per breakpoint (≈365px base, ≈445px at `min-width: 720px`; real height varies with card title line count, ≈441–477px on desktop, and `EmptyState` rails differ). The skeleton's 368px is derived from its CSS (`.header` 48 + margin 20 + `.scroll` 300), not measured — re-derive it when `.header`/`.scroll` change. Re-measure whenever a rail layout changes, otherwise scroll height jumps (CLS).
- `content-visibility: auto` implies paint containment: anything outside the section's padding box is clipped, including focus outlines. The desktop `MovieRail` `.section` uses `padding-inline: 2px; margin-inline: -2px` so the 2px `:focus-visible` outline of the flush title link / right arrow is not cut off — keep it if the header padding stays 0.
- Safari supports `content-visibility` only from 18; older WebKit falls back to normal rendering (accepted limitation).

## `useInView()` lazy-mount

- `useInView()` from `@shared/lib` (IntersectionObserver, once-trigger, only option `rootMargin`, default `'200px'`) lazy-mounts heavy always-mounted sections (`RelatedMovies`). It returns a **callback ref** (node kept in state), so an element that mounts after the first commit (conditional render) is still observed.
- Choose `content-visibility` for purely visual offscreen content; choose `useInView` when the React tree itself must not mount (render cost, subscriptions).
- Reserve space with placeholders that reuse the real grid classes and `aspect-ratio`, not a hardcoded `min-height` — the desktop grid is fluid. Safe only while nothing renders below `RelatedMovies` (revisit if `/movie/:id` gets a `Footer`).
- jsdom has no `IntersectionObserver`: `src/test/setup.ts` stubs it to report `isIntersecting: true` immediately. Tests for the "out of viewport" case override `window.IntersectionObserver` locally and restore it in `afterEach`.

## Images

- `loading='lazy' decoding='async'` on below-the-fold images (`Poster` by default, `CastTab` avatars, `MediaTab` screenshots). Home rail cards stay lazy even in the first viewport — browsers fetch in-viewport lazy images right away, and `/` LCP is unaffected.
- Never `loading='lazy'` on above-the-fold/LCP images — `PersonHero` photo is the LCP candidate of `/person/:id`; the `MovieHero` poster on `/movie/:id` is rendered with `<Poster eager />` (`loading='eager'`, no `decoding='async'`). No `fetchPriority='high'` there: on desktop the LCP element of `/movie/:id` is the CSS backdrop, and a high-priority poster would compete with it.
