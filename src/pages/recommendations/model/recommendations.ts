import { loadMoviesPage, type Movie } from '@entities/movie'
import { favoriteMovies } from '@features/favorites'
import { computeRecommendationQuery } from '@features/recommendations'
import {
  action,
  computed,
  isDeepEqual,
  withAsyncData,
  withMemo,
  wrap,
} from '@reatom/core'

// Page-slice фасад: композиция двух фич (favorites + recommendations) и сущности — ни одна фича
// не может импортировать другую. withMemo: структурно тот же запрос не перезапускает подборку.
export const recommendationQuery = computed(
  () => computeRecommendationQuery(favoriteMovies.data()),
  'recommendations.query',
).extend(withMemo(isDeepEqual))

// null — избранное есть, но ни один фильм не загрузился (все 404): строить подборку не из чего.
// [] — запрос валиден, каталог не нашёл совпадений. UI различает эти состояния.
export const recommendedMovies = computed(async (): Promise<Movie[] | null> => {
  // Ждём избранное: до его загрузки data() — пустой initState, и запрос вышел бы null.
  // Ошибка избранного пробрасывается сюда и показывается тем же error-фолбэком.
  await wrap(favoriteMovies())

  const query = recommendationQuery()
  if (!query) return null

  const { movies } = await wrap(loadMoviesPage(query, 1))
  return movies
}, 'recommendations.movies').extend(
  withAsyncData({ initState: null, status: true }),
)

// retry подборки не перезапрашивает избранное (его промис закэширован в computed) — если упало
// оно, повторяем его, а подборка пересчитается сама как зависимая.
export const retryRecommendations = action(() => {
  if (favoriteMovies.error()) favoriteMovies.retry()
  else recommendedMovies.retry()
}, 'recommendations.retry')
