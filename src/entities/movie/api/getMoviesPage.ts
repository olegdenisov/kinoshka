import {
  apiClient,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'
import { createQueryStore } from '@shared/lib'

import type { Movie } from '../model/types'
import { mapDocToMovie } from './mapDocToMovie'
import { PER_PAGE, MAX_PAGES } from './paginationConfig'

export type CatalogParams = MovieControllerFindManyByQueryV15Data['query']

export type CatalogPageResult = {
  movies: Movie[]
  totalPages: number
}

type CatalogPageParams = {
  params: CatalogParams
  page: number
}

type CursorStepParams = {
  params: CatalogParams
  cursor?: string
}

type CursorStepResult = {
  movies: Movie[]
  next: string | null
  total: number | null
}

const fetchCursorStep = async ({
  params,
  cursor,
}: CursorStepParams): Promise<CursorStepResult> => {
  const response = await apiClient.getV15Movie({
    query: {
      ...params,
      limit: PER_PAGE,
      next: cursor,
      // total нужен только с первого шага курсора (страница не меняется от шага к шагу)
      withCount: cursor === undefined,
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
    return { movies: [], next: null, total: null }
  }

  return {
    movies: response.data.docs.map(mapDocToMovie),
    next: response.data.next ?? null,
    total: response.data.total ?? null,
  }
}

// Один шаг курсора = один сетевой запрос. Внутренний стор: страницы 2 и 3 тех же params
// проходят общие шаги 1..N из кеша, а не заново (квота demo-API)
const cursorStepStore = createQueryStore<CursorStepParams, CursorStepResult>({
  name: 'catalogCursorStep',
  fetcher: fetchCursorStep,
})

const toTotalPages = (total: number | null): number => {
  // total недоступен (withCount не отработал) — не режем пагинацию, отдаём потолок demo-тарифа
  if (total === null) {
    return MAX_PAGES
  }

  return Math.min(MAX_PAGES, Math.ceil(total / PER_PAGE))
}

const walkToPage = async ({
  params,
  page,
}: CatalogPageParams): Promise<CatalogPageResult> => {
  let cursor: string | undefined
  let total: number | null = null
  let step: CursorStepResult = { movies: [], next: null, total: null }

  for (let current = 1; current <= page; current += 1) {
    step = await cursorStepStore.fetch({ params, cursor })

    if (current === 1) {
      total = step.total
    }

    if (current === page) {
      break
    }

    if (!step.next) {
      // курсор закончился раньше целевой страницы — пустой хвост
      return { movies: [], totalPages: toTotalPages(total) }
    }

    cursor = step.next
  }

  return { movies: step.movies, totalPages: toTotalPages(total) }
}

// Numbered-page поверх курсора: fetcher обходит шаги 1..page через cursorStepStore.fetch.
// Упавший шаг fetch() перезапрашивает, а не реплеит, поэтому Retry страницы реально идёт в сеть
export const catalogPageStore = createQueryStore<
  CatalogPageParams,
  CatalogPageResult
>({
  name: 'catalogPage',
  fetcher: walkToPage,
})
