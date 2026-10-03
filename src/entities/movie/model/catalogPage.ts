import { action, withAsync, wrap } from '@reatom/core'
import {
  apiClient,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'
import { withQueryCache } from '@shared/lib'

import { mapDocToMovie } from '../api/mapDocToMovie'
import { MAX_PAGES, PER_PAGE } from '../api/paginationConfig'
import type { Movie } from './types'

export type CatalogParams = MovieControllerFindManyByQueryV15Data['query']

export type CatalogPageResult = {
  movies: Movie[]
  totalPages: number
}

type CursorStepResult = {
  movies: Movie[]
  next: string | null
  total: number | null
}

// Ключ кэша — (params, cursor). Первый шаг — cursor null, а не undefined: кэш сравнивает
// массивы параметров, и пропущенный аргумент дал бы другой ключ, чем явный undefined; в
// sessionStorage (DEV) undefined к тому же сериализуется в null.
// Тело без wrap вокруг запроса: с ignoreAbort один промис делят все вызывающие, отмена первого
// не должна ронять запрос остальным.
const fetchCursorStep = action(
  async (
    params: CatalogParams,
    cursor: string | null,
  ): Promise<CursorStepResult> => {
    const response = await apiClient.getV15Movie({
      query: {
        ...params,
        limit: PER_PAGE,
        next: cursor ?? undefined,
        // total нужен только с первого шага курсора (страница не меняется от шага к шагу)
        withCount: cursor === null,
        notNullFields: ['poster.url', 'rating.kp', 'rating.imdb'],
        selectFields: [
          'id',
          'name',
          'year',
          'rating',
          'type',
          'genres',
          'movieLength',
          'poster',
        ],
      },
    })

    if (!('docs' in response.data)) {
      // нужно чтобы сузить тип
      return { movies: [], next: null, total: null }
    }

    return {
      movies: response.data.docs.map(mapDocToMovie),
      next: response.data.next ?? null,
      total: response.data.total ?? null,
    }
  },
  'movie.fetchCursorStep',
).extend(withAsync(), withQueryCache({ length: 50, ignoreAbort: true }))

const toTotalPages = (total: number | null): number => {
  // total недоступен (withCount не отработал) — не режем пагинацию, отдаём потолок demo-тарифа
  if (total === null) return MAX_PAGES

  return Math.min(MAX_PAGES, Math.ceil(total / PER_PAGE))
}

// API отдаёт только курсоры, поэтому страница N — обход шагов 1..N. Каждый шаг кэшируется
// отдельно: страница N после N−1 стоит одного запроса, повтор страницы — ни одного.
// Вызывается из computed/action — wrap держит кадр вызывающего между шагами.
export const loadMoviesPage = async (
  params: CatalogParams,
  page: number,
): Promise<CatalogPageResult> => {
  let cursor: string | null = null
  let total: number | null = null

  for (let current = 1; ; current += 1) {
    const step: CursorStepResult = await wrap(fetchCursorStep(params, cursor))

    if (current === 1) total = step.total
    if (current >= page) {
      return { movies: step.movies, totalPages: toTotalPages(total) }
    }
    // курсор закончился раньше целевой страницы — пустой хвост
    if (!step.next) return { movies: [], totalPages: toTotalPages(total) }

    cursor = step.next
  }
}
