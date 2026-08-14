import {
  getMoviesPage,
  getSearchMovies,
  invalidateMoviesPage,
} from '@entities/movie'
import type { Movie } from '@entities/movie'
import { filtersToParams } from '@features/catalog-filter'
import type { FilterState } from '@features/catalog-filter'
import { use } from 'react'

export type CatalogMode = 'search' | 'catalog'

export type MovieCatalogParams = {
  query: string
  filters: FilterState
  sort: string
  page: number
}

export type MovieCatalogResult = {
  movies: Movie[]
  mode: CatalogMode
  totalPages: number
}

/**
 * Фасад page-слоя (Task 8): единая точка входа для `SearchDesktop`/`SearchMobile`,
 * скрывающая двухэндпоинтную реальность API (Variant A — query и фильтры не сочетаются
 * в одном запросе).
 *
 * `query.trim()` непустой → текстовый поиск `/v1.5/movie/search` (`getSearchMovies`),
 * `filters`/`sort` игнорируются. `query.trim()` пустой → каталог по фильтрам `/v1.5/movie`
 * (`getMoviesPage(filtersToParams(filters, sort), page)`, курсорная эмуляция numbered-page).
 *
 * Импорт `filtersToParams` из `@features/catalog-filter` и фетчеров из `@entities/movie` —
 * оба вниз по FSD, легально только в page-слое (в `entities` импорт `features` был бы вверх).
 *
 * Обе ветки уже отдают `{ movies, totalPages }` — здесь только нормализуем к единой форме,
 * добавляя `mode`.
 */
export const useMovieCatalog = ({
  query,
  filters,
  sort,
  page,
}: MovieCatalogParams): MovieCatalogResult => {
  const trimmedQuery = query.trim()
  const mode: CatalogMode = trimmedQuery ? 'search' : 'catalog'

  const result = trimmedQuery
    ? use(getSearchMovies({ query: trimmedQuery, page }))
    : use(getMoviesPage(filtersToParams(filters, sort), page))

  return { movies: result.movies, mode, totalPages: result.totalPages }
}

/**
 * Companion-инвалидатор для Retry (roadmap 1.6, Task 5): та же ветка `trimmedQuery ? ... : ...`,
 * что в самом хуке чтения выше — иначе retry молча бил бы не по тому кэш-ключу, что читает
 * `useMovieCatalog`, и продолжал бы отдавать старый rejected-промис из cooldown
 * (`ERROR_CACHE_TTL_MS`, см. `createCachedFetcher`/`getMoviesPage`).
 *
 * search-режим (непустой query) → `getSearchMovies.invalidate({ query, page })` — тот же
 * `{ query: trimmedQuery, page }`, что уходит в `getSearchMovies(...)` выше.
 * catalog-режим (пустой query) → `invalidateMoviesPage(filtersToParams(filters, sort), page)`
 * (Task 2) — тот же `filtersToParams(filters, sort)`, что уходит в `getMoviesPage(...)` выше.
 *
 * Вызывается местом использования (`SearchDesktop`/`SearchMobile`, `AsyncBoundary.onRetry`)
 * ДО `reset()`.
 */
export const invalidateMovieCatalog = ({
  query,
  filters,
  sort,
  page,
}: MovieCatalogParams): void => {
  const trimmedQuery = query.trim()

  if (trimmedQuery) {
    getSearchMovies.invalidate({ query: trimmedQuery, page })
  } else {
    invalidateMoviesPage(filtersToParams(filters, sort), page)
  }
}
