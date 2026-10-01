import { movieByIdsApi, moviePageApi } from '@entities/movie'
import type { Movie } from '@entities/movie'
import { selectFavoriteIds } from '@features/favorites'
import type { FavoritesRootState } from '@features/favorites'
import { computeRecommendationQuery } from '@features/recommendations'
import { baseApi } from '@shared/api'
import type { QueryError } from '@shared/api'

// Endpoint в page-слое: композиция @features/favorites + @features/recommendations + @entities/movie
// легальна только здесь (ни одна фича не может импортировать другую).
export const recommendationsApi = baseApi.injectEndpoints({
  endpoints: build => ({
    // Без аргумента: id избранного читаются из стейта в момент запроса, поэтому кеш сам не узнает об их
    // изменении — его сбрасывает тег Recommendations (toggleFavorite и синхронизация вкладок).
    // null — избранное пусто или все id 404-нулись (правило не из чего строить), [] — каталог ничего
    // не нашёл; UI различает эти случаи.
    getRecommendations: build.query<Movie[] | null, void>({
      queryFn: async (_arg, { dispatch, getState }) => {
        const ids = selectFavoriteIds(getState() as FavoritesRootState)

        try {
          // Оба шага через initiate: детали избранного — из общего кеша /movie/:id, каталог — из кеша
          // шагов курсора. Перезапрос по тегу бьёт в сеть только за тем, что действительно изменилось.
          const favorites = await dispatch(
            movieByIdsApi.endpoints.getMoviesByIds.initiate(ids, {
              subscribe: false,
            }),
          ).unwrap()
          const params = computeRecommendationQuery(favorites)

          if (!params) {
            return { data: null }
          }

          const { movies } = await dispatch(
            moviePageApi.endpoints.getMoviesPage.initiate(
              { params, page: 1 },
              { subscribe: false },
            ),
          ).unwrap()

          return { data: movies }
        } catch (error) {
          // unwrap бросает error из queryFn вложенного endpoint — это уже QueryError
          return { error: error as QueryError }
        }
      },
      providesTags: ['Recommendations'],
    }),
  }),
})

export const { useGetRecommendationsQuery } = recommendationsApi
