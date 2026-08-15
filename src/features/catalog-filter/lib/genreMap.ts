/**
 * Каноническое значение жанра фильтра — русское `name` из живого справочника
 * API (`GET /v1.5/dictionary/genres`), ровно то, что ожидает параметр запроса
 * `genres.name` (см. `filtersToParams.ts`). Здесь — словарь RU→EN для отображения
 * английских лейблов чипов, инвертированный относительно прежнего EN→RU
 * `GENRE_MAP` (маппинг перед запросом больше не нужен — жанр уже хранится
 * на русском).
 *
 * Не все жанры справочника имеют устойчивый английский аналог — для них
 * `getGenreLabel` возвращает исходное русское название как фолбэк, а не
 * бросает/пропускает.
 */
export const GENRE_LABELS: Record<string, string> = {
  боевик: 'Action',
  драма: 'Drama',
  фантастика: 'Sci-Fi',
  триллер: 'Thriller',
  мелодрама: 'Romance',
  ужасы: 'Horror',
  детектив: 'Mystery',
  документальный: 'Documentary',
  история: 'Historical',
  приключения: 'Adventure',
  семейный: 'Family',
  фэнтези: 'Fantasy',
}

export const getGenreLabel = (ruName: string): string =>
  GENRE_LABELS[ruName] ?? ruName
