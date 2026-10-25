# RTK Query: разница бандла с `main`

Gzip-размеры из `size-limit`, оба билда с `VITE_SENTRY_DSN`. `main` собран в отдельном worktree.

| Чанк                 | main, KB | rtk-migration, KB | diff, KB |
| -------------------- | -------- | ----------------- | -------- |
| entry                | 3.53     | 3.83              | +0.30    |
| vendor               | 169.15   | 194.32            | +25.17   |
| shared               | 21.57    | 22.38             | +0.81    |
| page-home            | 2.58     | 2.47              | -0.11    |
| page-movie           | 8.04     | 8.07              | +0.03    |
| page-favorites       | 1.15     | 1.18              | +0.03    |
| page-watched         | 1.14     | 1.17              | +0.03    |
| page-watchlist       | 1.09     | 1.12              | +0.03    |
| page-popular         | 1.13     | 1.17              | +0.04    |
| page-recommendations | 1.24     | 1.46              | +0.22    |
| page-search          | 5.88     | 5.58              | -0.30    |
| page-profile         | 2.79     | 2.80              | +0.01    |
| page-person          | 3.82     | 3.84              | +0.02    |

Итого: около +26.2 KB gzip, почти всё в `vendor`: `@reduxjs/toolkit` и `react-redux` лежат там, ни в одном `page-*`/`shared` чанке их кода нет (проверено grep по `createListenerMiddleware`/`configureStore`/`createApi`).

Лимиты `vendor` (223.5 KB) и `page-recommendations` (1.7 KB) пересчитаны как измеренный gzip + 15%; остальные прошли со старым запасом и не менялись.
