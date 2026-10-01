/**
 * Статические опции новых фильтров каталога. Платформы и подборки захардкожены
 * намеренно: словаря платформ в API нет, а `/list` отдаёт сотни авто-подборок
 * (`country1`, `year2018`, …), бесполезных как фильтр. Значения сверены с живым
 * API — при смене на его стороне фильтр молча даёт пустую выдачу, правится здесь.
 */

export type FilterOption<T extends string = string> = {
  value: T
  label: string
}

export const DURATION_VALUES = ['short', 'medium', 'long'] as const

export type Duration = (typeof DURATION_VALUES)[number]

/** Пресет длительности → лейбл и диапазон `movieLength` (минуты) для API. */
export const DURATION_OPTIONS: ReadonlyArray<
  FilterOption<Duration> & { range: string }
> = [
  { value: 'short', label: 'Under 90 min', range: '1-89' },
  { value: 'medium', label: '90–120 min', range: '90-120' },
  { value: 'long', label: 'Over 2 hours', range: '121-999' },
]

/** Каноническое значение — имя платформы из `watchability.items.name` как есть. */
export const PLATFORM_OPTIONS: ReadonlyArray<FilterOption> = [
  { value: 'Kinopoisk HD', label: 'Kinopoisk HD' },
  { value: 'Иви', label: 'Ivi' },
  { value: 'Okko', label: 'Okko' },
  { value: 'Wink', label: 'Wink' },
  { value: 'КИОН', label: 'Kion' },
  { value: 'PREMIER', label: 'Premier' },
  { value: 'START', label: 'Start' },
  { value: 'Amediateka', label: 'Amediateka' },
]

/** Slug подборки (`lists`) → лейбл. */
export const LIST_OPTIONS: ReadonlyArray<FilterOption> = [
  { value: 'top250', label: 'Top 250' },
  { value: 'top500', label: 'Top 500' },
  { value: 'series-top250', label: 'Top 250 series' },
  { value: 'popular-films', label: 'Popular movies' },
  { value: 'popular-series', label: 'Popular series' },
  { value: 'hd-must-see', label: 'Must see' },
  { value: '100_greatest_movies_XXI', label: 'Best of the 21st century' },
  { value: 'oscar-best-film-nominees', label: 'Oscar nominees' },
]

// API не отдаёт `enName` для стран — английские подписи есть только у шорт-листа,
// остальные страны показываются по-русски. Не экспортируется: снаружи нужен только
// getCountryLabel (knip флагует неиспользуемый export, как у GENRE_LABELS).
const COUNTRY_LABELS: Record<string, string> = {
  США: 'USA',
  Россия: 'Russia',
  Великобритания: 'UK',
  Франция: 'France',
  Германия: 'Germany',
  Италия: 'Italy',
  Япония: 'Japan',
  'Южная Корея': 'South Korea',
  Испания: 'Spain',
  Канада: 'Canada',
}

const findLabel = (options: ReadonlyArray<FilterOption>, value: string) =>
  options.find(option => option.value === value)?.label ?? value

/** Все хелперы фолбэкают на сырое значение (как `getGenreLabel`). */
export const getDurationLabel = (value: string): string =>
  findLabel(DURATION_OPTIONS, value)

export const getPlatformLabel = (value: string): string =>
  findLabel(PLATFORM_OPTIONS, value)

export const getListLabel = (value: string): string =>
  findLabel(LIST_OPTIONS, value)

export const getCountryLabel = (ruName: string): string =>
  COUNTRY_LABELS[ruName] ?? ruName
