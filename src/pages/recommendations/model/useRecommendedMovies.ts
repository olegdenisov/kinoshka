import type { Movie } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import type { QueryResult } from '@shared/lib'

import { recommendationsStore } from './recommendationsStore'

/**
 * Page-slice facade: `useFavorites()` (`@features/favorites`) + query-стор рекомендаций,
 * внутри которого `moviesByIdsStore` (`@entities/movie`) + `computeRecommendationQuery()`
 * (`@features/recommendations`) + `catalogPageStore` — ни один `@features/*` не может
 * импортировать другой напрямую, а page-слой легально импортирует оба вниз (см. AGENTS.md,
 * "Page-slice model/ facade").
 *
 * `data === null`: избранное пусто либо не дало правила (например, все id 404-нулись);
 * `Movie[]` (возможно пустой) — каталог ответил. Различие `null` vs `[]` нужно UI.
 */
export const useRecommendedMovies = (): QueryResult<Movie[] | null> => {
  const { ids } = useFavorites()

  return recommendationsStore.useQuery(ids)
}
