import { computed, withAsyncData, wrap } from '@reatom/core'
import { ApiError } from '@shared/api'

import { fetchMovieDetail } from './movieDetail'
import type { Movie } from './types'

const isNotFound = (reason: unknown) =>
  reason instanceof ApiError && reason.status === 404

// ids — реактивный источник (атом или computed), а не массив: ресурс пересчитывается при смене
// набора, а уже загруженные фильмы берутся из кэша fetchMovieDetail без запроса.
export const reatomMoviesByIds = (ids: () => Iterable<number>, name: string) =>
  computed(async (): Promise<Movie[]> => {
    const list = [...ids()]
    if (list.length === 0) return []

    const results = await wrap(
      Promise.allSettled(list.map(id => fetchMovieDetail(id))),
    )

    const movies = results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)

    // Все id 404 → фильмы удалены, показываем пустой грид без Retry (нечего повторять).
    // Хотя бы одна ошибка не 404 (сеть, 5xx, quota) при пустом результате восстановима —
    // пробрасываем, чтобы показать ошибку с рабочим Retry, а не тихий EmptyState.
    const hasRecoverableFailure = results.some(
      result => result.status === 'rejected' && !isNotFound(result.reason),
    )

    if (movies.length === 0 && hasRecoverableFailure) {
      throw new Error('Failed to load movies by ids')
    }

    return movies
  }, name).extend(withAsyncData({ initState: [], status: true }))
