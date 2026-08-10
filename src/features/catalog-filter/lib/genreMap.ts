/**
 * UI-жанры (ALL_GENRES из @entities/movie/model/catalog.ts и локальной копии
 * в SearchSidebar.tsx) заведены на английском, а API (`genres.name`) ждёт
 * русские названия. Здесь — словарь EN→RU для маппинга перед запросом.
 *
 * Не все UI-жанры имеют устойчивый аналог в KP-справочнике жанров
 * (например 'Slice of Life') — для них toApiGenre возвращает undefined,
 * вызывающий код должен такие жанры отбрасывать (skip), а не падать.
 */
export const GENRE_MAP: Record<string, string> = {
  Action: "боевик",
  Drama: "драма",
  "Sci-Fi": "фантастика",
  Thriller: "триллер",
  Romance: "мелодрама",
  Horror: "ужасы",
  Mystery: "детектив",
  Documentary: "документальный",
  Historical: "история",
  Adventure: "приключения",
  Family: "семейный",
  Fantasy: "фэнтези",
}

export const toApiGenre = (genre: string): string | undefined =>
  GENRE_MAP[genre]
