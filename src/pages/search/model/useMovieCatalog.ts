import { getMoviesPage, getSearchMovies } from '@entities/movie'
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
