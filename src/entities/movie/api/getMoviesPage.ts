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

// --- Мост до Task 14: рекомендации ещё читают каталог через use(getMoviesPage(...)) ---

type PageCacheEntry = {
  promise: Promise<CatalogPageResult>
  timestamp: number
  isError: boolean
}

// page-level промис-мемо: use() требует один и тот же promise reference на каждый render,
// пока он не разрешится
const pageCache = new Map<string, PageCacheEntry>()

// Ошибку держим 20 с, а не удаляем сразу в .catch: новый промис на каждый render после
// реджекта увёл бы use() в бесконечный цикл ре-саспенда
const ERROR_CACHE_TTL_MS = 20 * 1000

const isFreshEntry = (entry: PageCacheEntry) =>
  !entry.isError || Date.now() - entry.timestamp < ERROR_CACHE_TTL_MS

export const getMoviesPage = (
  params: CatalogParams,
  page: number,
): Promise<CatalogPageResult> => {
  const key = JSON.stringify({ params, page })
  const cached = pageCache.get(key)

  if (cached && isFreshEntry(cached)) {
    return cached.promise
  }

  const entry: PageCacheEntry = {
    promise: catalogPageStore.fetch({ params, page }),
    timestamp: Date.now(),
    isError: false,
  }

  entry.promise.catch(() => {
    entry.isError = true
    entry.timestamp = Date.now()
  })

  pageCache.set(key, entry)

  return entry.promise
}

// Retry моста: снимаем page-level мемо и помечаем протухшими страницу и первый шаг курсора —
// как на main, повторный вызов идёт в сеть даже после успешного ответа
export const invalidateMoviesPage = (
  params: CatalogParams,
  page: number,
): void => {
  pageCache.delete(JSON.stringify({ params, page }))
  catalogPageStore.invalidate({ params, page })
  cursorStepStore.invalidate({ params, cursor: undefined })
}
