# Zustand: разница бандла с `main` и `rtk`

Gzip-размеры из `size-limit`, все билды с `VITE_SENTRY_DSN`. `main` собран в отдельном worktree, цифры `rtk` взяты из `docs/concepts/rtk-bundle-diff.md` ветки `rtk`.

| Чанк                 | main, KB | rtk, KB | zustand, KB | diff с main, KB | diff с rtk, KB |
| -------------------- | -------- | ------- | ----------- | --------------- | -------------- |
| entry                | 3.53     | 3.83    | 3.54        | +0.01           | -0.29          |
| vendor               | 169.15   | 194.32  | 170.45      | +1.30           | -23.87         |
| shared               | 21.57    | 22.38   | 22.17       | +0.60           | -0.21          |
| page-home            | 2.58     | 2.47    | 2.47        | -0.11           | 0.00           |
| page-movie           | 8.04     | 8.07    | 8.08        | +0.04           | +0.01          |
| page-favorites       | 1.15     | 1.18    | 1.10        | -0.05           | -0.08          |
| page-watched         | 1.14     | 1.17    | 1.09        | -0.05           | -0.08          |
| page-watchlist       | 1.09     | 1.12    | 1.06        | -0.03           | -0.06          |
| page-popular         | 1.13     | 1.17    | 1.16        | +0.03           | -0.01          |
| page-recommendations | 1.24     | 1.46    | 1.22        | -0.02           | -0.24          |
| page-search          | 5.88     | 5.58    | 5.73        | -0.15           | +0.15          |
| page-profile         | 2.80     | 2.80    | 2.79        | -0.01           | -0.01          |
| page-person          | 3.82     | 3.84    | 3.85        | +0.03           | +0.01          |

Итого к `main`: около +1.6 KB gzip, почти всё в `vendor` (сам `zustand` и `zustand/middleware`: `persist`). Против `rtk` ветка легче примерно на 25 KB, главным образом из-за `vendor`.

`devtools` middleware в прод-сборку не попадает: в трёх местах (`createPersistedStore`, `createQueryStore`, `searchUiStore`) он подключается веткой по `import.meta.env.DEV`. Опция `enabled: import.meta.env.DEV` для этого не годится: код middleware остаётся в бандле (так было в `searchUiStore`, +1.2 KB в `vendor`). Проверка: `grep "zustand devtools" dist/assets/*.js` — пусто.

Лимиты `size-limit` не менялись: все чанки укладываются в действующие, запас не меньше 7% (`vendor` 170.45 из 184.7, `entry` 3.54 из 4.05, `shared` 22.17 из 22.6).
