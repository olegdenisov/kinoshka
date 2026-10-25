import { catalogPageStore, moviesByIdsStore } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { computeRecommendationQuery } from '@features/recommendations'
import { createQueryStore } from '@shared/lib'

// Вся цепочка (избранное → правило → каталог) внутри одного fetcher'а: наружу один QueryResult
// и один refetch, склеивать состояния двух запросов не нужно. Вложенные шаги идут через fetch()
// — кеш общий с детальной страницей и каталогом, а упавший шаг при Retry перезапрашивается.
// Ключ — id избранного: изменилось избранное → новый ключ → стор сам перезапрашивает.
// null (пустое избранное / правило не сработало) возвращает fetcher без сетевого запроса:
// через skip data === undefined, и QueryBoundary показывал бы fallback бесконечно.
export const recommendationsStore = createQueryStore<number[], Movie[] | null>({
  name: 'recommendations',
  fetcher: async ids => {
    const favorites = await moviesByIdsStore.fetch(ids)
    const query = computeRecommendationQuery(favorites)

    if (!query) {
      return null
    }

    const { movies } = await catalogPageStore.fetch({ params: query, page: 1 })

    return movies
  },
})
