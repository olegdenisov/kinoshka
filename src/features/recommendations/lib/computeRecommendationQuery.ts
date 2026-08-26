import type { CatalogParams, Movie } from '@entities/movie'

/** Сколько самых частых жанров избранного берём в запрос рекомендаций. */
const TOP_GENRES_COUNT = 3

/** Буфер вычитания из среднего рейтинга избранного — решено в Q&A плана (шире выдача, не точное среднее). */
const RATING_BUFFER = 1

/**
 * Топ-N жанров избранного по частоте. При равной частоте порядок — по первому
 * появлению жанра в `favorites` (Map сохраняет порядок вставки ключей).
 */
const topGenresByFrequency = (favorites: Movie[], count: number): string[] => {
  const counts = new Map<string, number>()

  for (const movie of favorites) {
    for (const genre of movie.genre) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1)
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([genre]) => genre)
}

/**
 * Чистая функция-правило рекомендаций: избранное → query для `getMoviesPage`
 * (тот же каталожный эндпоинт, что `/search`), или `null`, если по пустому
 * избранному строить рекомендации нечего (см. Solution Overview в плане —
 * `null` отличается от `[]`, который каталог может вернуть по валидному query).
 *
 * Формула (Technical Details плана):
 * - `id`: exclude всех favoriteIds через `!<id>` (документированный синтаксис API)
 * - `genres.name`: топ-3 жанра избранного по частоте (без `genres.name`, если у
 *   всех избранных фильмов пустой `genre`)
 * - `rating.kp`: `[(avg − 1)-10]` по фильмам избранного с `rating > 0` (без
 *   `rating.kp`, если ни один избранный фильм не имеет рейтинга — фильмы с
 *   `rating === 0` пропускаются при подсчёте среднего, а не считаются за 0)
 * - `sortField`/`sortType`: всегда `rating.kp` / `-1` (сортировка по рейтингу)
 * - без `limit` — `fetchCursorStep` (`getMoviesPage.ts`) безусловно перезаписывает
 *   его на `PER_PAGE`, указывать здесь — мёртвый код (см. Technical Details)
 */
export const computeRecommendationQuery = (
  favorites: Movie[],
): NonNullable<CatalogParams> | null => {
  if (favorites.length === 0) {
    return null
  }

  const topGenres = topGenresByFrequency(favorites, TOP_GENRES_COUNT)

  const ratedFavorites = favorites.filter(movie => movie.rating > 0)
  const avgRating =
    ratedFavorites.length > 0
      ? ratedFavorites.reduce((sum, movie) => sum + movie.rating, 0) /
        ratedFavorites.length
      : null
  const ratingFloor =
    avgRating !== null ? Math.max(0, avgRating - RATING_BUFFER) : null

  const params: NonNullable<CatalogParams> = {
    id: favorites.map(movie => `!${movie.id}`),
    sortField: ['rating.kp'],
    sortType: ['-1'],
  }

  if (topGenres.length > 0) {
    params['genres.name'] = topGenres
  }

  if (ratingFloor !== null) {
    params['rating.kp'] = [`${ratingFloor.toFixed(1)}-10`]
  }

  return params
}
