import { type QueryResult } from '@shared/lib'

import { moviesByIdsStore } from '../api/getMoviesByIds'
import type { Movie } from '../model/types'

const EMPTY: Movie[] = []

// Общая основа useFavoriteMovies/useWatchedMovies/useWatchlistMovies
export const useMoviesByIds = (ids: number[]): QueryResult<Movie[]> => {
  const isEmpty = ids.length === 0
  // keepPreviousData: при удалении карточки ключ меняется, но сетка не мигает скелетоном
  const query = moviesByIdsStore.useQuery(ids, {
    skip: isEmpty,
    keepPreviousData: true,
  })

  // Пустой список → skip, а data === undefined заставил бы QueryBoundary показать fallback
  if (isEmpty) return { ...query, data: EMPTY, isLoading: false }

  // Данные прошлого ключа фильтруем по текущим ids: удалённая карточка исчезает сразу,
  // не дожидаясь ответа по новому ключу
  const idSet = new Set(ids)

  return {
    ...query,
    data: query.data?.filter(movie => idSet.has(movie.id)),
  }
}
