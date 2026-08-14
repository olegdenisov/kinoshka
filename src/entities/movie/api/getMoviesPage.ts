import {
  apiClient,
  type MovieControllerFindManyByQueryV15Data,
} from '@shared/api'

import type { Movie } from '../model/types'
import { createCachedFetcher } from './createCachedFetcher'
import { mapDocToMovie } from './mapDocToMovie'
import { PER_PAGE, MAX_PAGES } from './paginationConfig'

export type CatalogParams = MovieControllerFindManyByQueryV15Data['query']

export type CatalogPageResult = {
  movies: Movie[]
  totalPages: number
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

// Кеш шагов-курсоров по ключу (params, cursor) — обобщённая фабрика Task 4
// даёт 403-cooldown и session-persist бесплатно.
const cachedCursorStep = createCachedFetcher('catalog-cursor', fetchCursorStep)

export const fetchCatalogCursor = (
  params: CatalogParams,
  cursor?: string,
): Promise<CursorStepResult> => cachedCursorStep({ params, cursor })

const toTotalPages = (total: number | null): number => {
  // total недоступен (withCount не отработал) — не режем пагинацию, отдаём потолок demo-тарифа
  if (total === null) {
    return MAX_PAGES
  }

  return Math.min(MAX_PAGES, Math.ceil(total / PER_PAGE))
}

const walkToPage = async (
  params: CatalogParams,
  page: number,
): Promise<CatalogPageResult> => {
  let cursor: string | undefined
  let total: number | null = null
  let step: CursorStepResult = { movies: [], next: null, total: null }

  for (let current = 1; current <= page; current += 1) {
    step = await fetchCatalogCursor(params, cursor)

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

type PageCacheEntry = {
  promise: Promise<CatalogPageResult>
  timestamp: number
  isError: boolean
}

// page-level промис-мемо: обход next 1..N выполняется один раз на (params, page);
// повторный вызов возвращает тот же Promise (важно для стабильности use()/Suspense —
// React должен видеть один и тот же promise reference на каждый render, пока он ждёт
// его разрешения). In-memory, не переживает reload — см. план (Post-Completion).
const pageCache = new Map<string, PageCacheEntry>()

// Тот же cooldown, что ERROR_CACHE_TTL_MS в createCachedFetcher — после него один и тот
// же (params, page) реально повторяет запрос вместо того, чтобы навечно отдавать
// rejected promise (баг до фикса — CRITICAL finding). Важно: мы НЕ удаляем/подменяем
// запись сразу в .catch — если бы промис менялся синхронно с исходом, компонент,
// всё ещё зовущий use() на старом (уже rejected) промисе в том же React-цикле
// suspend→retry→ErrorBoundary, получал бы каждый раз новый pending promise и уходил
// в бесконечный цикл ре-саспенда (проверено вручную: React ругается "suspended by an
// uncached promise" в цикле). TTL даёт стабильность reference на время cooldown, но
// не кеширует ошибку навсегда.
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
    promise: walkToPage(params, page),
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

// Точечная инвалидация для Retry (roadmap 1.6). Принятое ограничение: чистим
// запись pageCache для (params, page) + первый шаг курсора (детерминирован,
// cursor: undefined не зависит от целевой page) — доминирующий сценарий отказа,
// 403 квоты демо-тарифа, рвёт все шаги одинаково, так что достаточно снять
// cooldown с первого шага, чтобы walkToPage реально пошёл в сеть заново. Если
// сбой был именно на промежуточном шаге (>1) при живом первом шаге — редкий
// случай (нужен независимо упавший intermediate-запрос), тот шаг всё ещё ждёт
// ERROR_CACHE_TTL_MS; не усложняем инвалидацию ради него.
export const invalidateMoviesPage = (
  params: CatalogParams,
  page: number,
): void => {
  pageCache.delete(JSON.stringify({ params, page }))
  cachedCursorStep.invalidate({ params, cursor: undefined })
}
