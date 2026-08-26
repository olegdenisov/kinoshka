import {
  getMoviesByIds,
  getMoviesPage,
  invalidateMoviesPage,
} from '@entities/movie'
import type { CatalogParams, Movie } from '@entities/movie'
import { useFavoriteMovies } from '@features/favorites'
import { computeRecommendationQuery } from '@features/recommendations'
import { use } from 'react'

/**
 * Page-slice facade (Task 2 плана `docs/plans/20260825-recommendations-rule-based.md`):
 * композиция `useFavoriteMovies()` (`@features/favorites`, Suspense) + `computeRecommendationQuery()`
 * (`@features/recommendations`) + `getMoviesPage()` (`@entities/movie`) — тот же паттерн, что
 * `useMovieCatalog` в `pages/search/model/` (см. AGENTS.md, "Page-slice model/ facade"): ни
 * один из `@features/*` не может импортировать другой `@features/*` напрямую, а page-слой
 * легально импортирует оба вниз.
 *
 * Возвращает `null`, если `computeRecommendationQuery` вернул `null` (пустое избранное после
 * `getMoviesByIds` — часть id могла 404-нуться), и `Movie[]` (возможно пустой) иначе — см.
 * Solution Overview в плане про различие `null` vs `[]` для UI.
 */
export const useRecommendedMovies = (): Movie[] | null => {
  const favorites = useFavoriteMovies()
  const query = computeRecommendationQuery(favorites)
  lastQuery = query

  if (!query) {
    return null
  }

  const { movies } = use(getMoviesPage(query, 1))

  return movies
}

// Module-level запоминание последнего вычисленного query — вход правила (favorites) сам
// приходит из Suspense и недоступен синхронно снаружи AsyncBoundary в месте вызова onRetry
// (в отличие от useMovieCatalog, где filters/sort/page синхронно доступны вызывающей стороне).
// Мутация во время рендера — тот же приём, что уже используют pageCache/createCachedFetcher
// (module-level Map, обновляемый внутри функции, вызываемой из use() во время рендера);
// идемпотентно, повторная запись тем же значением при StrictMode-double-invoke безвредна.
let lastQuery: NonNullable<CatalogParams> | null = null

/**
 * Companion-инвалидатор для Retry (тот же паттерн, что `invalidateMovieCatalog`/
 * `invalidateMovieDetail`/`invalidatePopularMovies` — см. AGENTS.md): чистит кэш
 * favorites-фетча (`getMoviesByIds`) и кэш каталожного шага по ПОСЛЕДНЕМУ вычисленному
 * query (`invalidateMoviesPage`) — иначе Retry бил бы только по кэшу favorites, а
 * `getMoviesPage(query, 1)` продолжал бы отдавать закэшированный rejected-промис ещё до
 * истечения `ERROR_CACHE_TTL_MS` (20с), даже после успешного обновления избранного.
 */
export const invalidateRecommendations = (ids: number[]): void => {
  getMoviesByIds.invalidate(ids)

  if (lastQuery) {
    invalidateMoviesPage(lastQuery, 1)
  }
}
