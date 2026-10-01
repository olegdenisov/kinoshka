// Шорт-лист стран: дефолтный видимый набор чипов в CountrySelector и фолбэк useCountryDictionary,
// пока localStorage-кэш пуст. Только канонические RU-имена (`countries.name` в API) — английские
// подписи живут в фиче (COUNTRY_LABELS), как жанровые в genreMap. Здесь, а не в фиче, по той же
// причине, что STATIC_FALLBACK_GENRES: хуку в entities нельзя импортировать вверх по FSD.
export const STATIC_FALLBACK_COUNTRIES: string[] = [
  'США',
  'Россия',
  'Великобритания',
  'Франция',
  'Германия',
  'Италия',
  'Япония',
  // Именно так в живом словаре (`/v1.5/dictionary/countries`): «Южная Корея» фильтр не находит.
  'Корея Южная',
  'Испания',
  'Канада',
]
