export { useFavorites } from './model/useFavorites'
export type { UseFavoritesResult } from './model/useFavorites'
export { useFavoriteMovies } from './model/useFavoriteMovies'
export {
  favoritesReducer,
  favoritesReducerPath,
  registerFavoritesPersistence,
  selectFavoriteIds,
} from './model/favoritesSlice'
export type { FavoritesRootState } from './model/favoritesSlice'
