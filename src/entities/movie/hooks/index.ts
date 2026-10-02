export { useNewMovies } from './useNewMovies'
export { useTopRatedMovies } from './useTopRatedMovies'
export { useMovieDetail } from './useMovieDetail'
export { useMoviesByIds } from './useMoviesByIds'
export { usePopularMovies } from './usePopularMovies'
export type { MovieDetailBundle } from './useMovieDetail'
export {
  invalidateGenreDictionary,
  resetGenreDictionaryState,
  useGenreDictionary,
} from './useGenreDictionary'
export { useCountryDictionary } from './useCountryDictionary'
// Тестовая утилита для глобального afterEach (src/test/setup.ts) — напрямую из api, без хука.
export { resetCountryDictionaryState } from '../api/countryDictionaryCache'
