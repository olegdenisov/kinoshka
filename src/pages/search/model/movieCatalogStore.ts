import { catalogPageStore, fetchSearchMovies } from '@entities/movie'
import type { CatalogParams, Movie } from '@entities/movie'
import { createQueryStore } from '@shared/lib'

type CatalogMode = 'search' | 'catalog'

// query пустой → каталог по params; непустой → текстовый поиск, params игнорируются
// (API не сочетает query и фильтры). Неиспользуемая половина ключа обнулена вызывающей
// стороной, чтобы одинаковые запросы не расходились по разным ключам
export type MovieCatalogKey = {
  query: string
  params: CatalogParams
  page: number
}

export type MovieCatalogResult = {
  movies: Movie[]
  // mode — часть данных, а не вывод из параметров: при keepPreviousData на экране может
  // быть выдача прошлого режима
  mode: CatalogMode
  totalPages: number
}

const fetchMovieCatalog = async ({
  query,
  params,
  page,
}: MovieCatalogKey): Promise<MovieCatalogResult> => {
  if (query) {
    const result = await fetchSearchMovies({ query, page })
    return { ...result, mode: 'search' }
  }

  const result = await catalogPageStore.fetch({ params, page })
  return { ...result, mode: 'catalog' }
}

// Один стор на оба режима: один useQuery, поэтому при переключении поиск ↔ каталог
// keepPreviousData держит прежнюю сетку
export const movieCatalogStore = createQueryStore<
  MovieCatalogKey,
  MovieCatalogResult
>({
  name: 'movieCatalog',
  fetcher: fetchMovieCatalog,
})
