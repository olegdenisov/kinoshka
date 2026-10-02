import { ApiError } from '@shared/api'
import { createCachedFetcher, createQueryStore } from '@shared/lib'

import type { Movie } from '../model/types'
import { movieDetailStore } from './getMovieDetail'

const isNotFound = (reason: unknown) =>
  reason instanceof ApiError && reason.status === 404

const fetchMoviesByIds = async (ids: number[]): Promise<Movie[]> => {
  const results = await Promise.allSettled(
    ids.map(id => movieDetailStore.fetch(id)),
  )

  const movies = results
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)

  // Все id 404 → фильмы удалены, показываем пустой грид без Retry (нечего повторять).
  // Хотя бы одна ошибка не 404 (сеть, 5xx, quota) → это восстановимо, пробрасываем,
  // чтобы boundary показал реальный error-фолбэк с рабочим Retry, а не тихо
  // подменял его на статичный EmptyState с текстом "Try again later" без кнопки.
  const hasRecoverableFailure = results.some(
    result => result.status === 'rejected' && !isNotFound(result.reason),
  )

  if (movies.length === 0 && hasRecoverableFailure) {
    throw new Error('Failed to load movies by ids')
  }

  return movies
}

export const getMoviesByIds = createCachedFetcher<number[], Movie[]>(
  'movies-by-ids',
  fetchMoviesByIds,
)

// Ключ — массив id (JSON.stringify по умолчанию). Detail каждого id берётся через
// movieDetailStore.fetch — общий кеш с детальной страницей, второй запрос за тем же фильмом не уходит
export const moviesByIdsStore = createQueryStore<number[], Movie[]>({
  name: 'moviesByIds',
  fetcher: fetchMoviesByIds,
})
