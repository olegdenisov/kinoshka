---
worth: yes
added: 2026-08-24
---
# screenshots block shows placeholder gradients instead of hiding when empty

On `/movie/:id`, when `images.length === 0`, both `MediaTab.tsx` (desktop tab,
`src/pages/movie/ui/tabs/MediaTab/MediaTab.tsx:42-64`) and `MovieMobile.tsx` (mobile,
`src/pages/movie/ui/MovieMobile/MovieMobile.tsx:352-372`) render the "Screenshots" section head
plus a grid of 8 decorative gradient placeholders (`FALLBACK_SCREENSHOT_COUNT`) instead of hiding
the section entirely. Confirmed unwanted: the block should not render at all when there is no
image data for the movie.
