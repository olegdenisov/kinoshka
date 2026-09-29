---
paths:
  - 'src/widgets/movie-rail/**'
  - 'src/pages/movie/ui/RelatedMovies/**'
  - 'src/shared/lib/inView/**'
  - 'src/test/setup.ts'
---

# Performance: rails, lazy-mount, images

History and Lighthouse before/after numbers: `docs/plans/completed/20260916-performance-virtualization-lazy-loading.md`.

## No virtualization for home rails

- Home rails are **not** virtualized (`@tanstack/react-virtual`/`react-window`): the demo API tier caps a rail at ≤10 cards, and a list that short gains nothing while virtualization conflicts with the hover-arrow `scrollBy(480px)` in `MovieRail`.
- The ≤10 ceiling is an **external fact, not readable from code** for 3 of 4 rails (`useNewMovies`/`useTopRatedMovies` pass no `limit` to `getMovies.ts`; only `usePopularMovies` sets `limit: 10`). Revisit if the API tier changes or an explicit `limit` is added to `getMovies.ts`.
- `/search` stays on numbered pagination (`MAX_PAGE = 10`), so grid virtualization does not apply until it moves to infinite scroll.

## `content-visibility: auto`

- Set on `.section` in **both** `MovieRail.module.css` and `MovieRailSkeleton.module.css` — the skeleton is what Lighthouse actually sees during the measured window, so optimizing only the loaded state has no effect.
- `contain-intrinsic-size: auto <px>` holds measured heights: `MovieRail` differs per breakpoint (365px base, 445px at `min-width: 720px`), the skeleton is one fixed 368px. Re-measure whenever a rail layout changes, otherwise scroll height jumps (CLS).
- Safari supports `content-visibility` only from 18; older WebKit falls back to normal rendering (accepted limitation).

## `useInView()` lazy-mount

- `useInView<HTMLDivElement>()` from `@shared/lib` (IntersectionObserver, once-trigger, default `rootMargin: '200px'`) lazy-mounts heavy always-mounted sections (`RelatedMovies`). Pass the element type explicitly at DOM call sites — `RefObject<T>` is invariant, the `HTMLElement` default does not fit `<div ref>`.
- Choose `content-visibility` for purely visual offscreen content; choose `useInView` when the React tree itself must not mount (render cost, subscriptions).
- Reserve space with placeholders that reuse the real grid classes and `aspect-ratio`, not a hardcoded `min-height` — the desktop grid is fluid. Safe only while nothing renders below `RelatedMovies` (revisit if `/movie/:id` gets a `Footer`).
- jsdom has no `IntersectionObserver`: `src/test/setup.ts` stubs it to report `isIntersecting: true` immediately. Tests for the "out of viewport" case override `window.IntersectionObserver` locally and restore it in `afterEach`.

## Images

- `loading='lazy' decoding='async'` on below-the-fold images (`Poster`, `CastTab` avatars, `MediaTab` screenshots).
- Never `loading='lazy'` on above-the-fold/LCP images — `PersonHero` photo is the LCP candidate of `/person/:id`.
