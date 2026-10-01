export { Card } from './ui/Card'
export { Poster } from './ui/Poster'
export { PopularBadge } from './ui/PopularBadge'
export type {
  Movie,
  MovieDetail,
  CastMember,
  CrewMember,
  PopularMovie,
} from './model/types'
export { STATIC_FALLBACK_GENRES } from './model/genre'
export { STATIC_FALLBACK_COUNTRIES } from './model/country'
export type { CatalogParams } from './api/movieApi'
export type { MovieImage } from './api/movieApi'
export {
  movieByIdsApi,
  moviePageApi,
  useGetCatalogQuery,
  useGetMoviesByIdsQuery,
} from './api/movieApi'
// Тестовая утилита для глобального afterEach (src/test/setup.ts): кулдаун справочников —
// модульное состояние, свежий стор на тест его не сбрасывает.
export { resetDictionaryCooldowns } from './api/createDictionaryCache'
export { formatCurrency } from './lib/formatCurrency'
export { formatDate } from './lib/formatDate'
export * from './hooks'
