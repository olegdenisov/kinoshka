import type { MovieControllerFindManyByQueryV15Data } from '@shared/api'

import type { Movie } from '../model/types'

// Параметры /v1.5/movie: каталог /search, подборки главной, рекомендации.
export type CatalogParams = MovieControllerFindManyByQueryV15Data['query']

export type CatalogPageResult = {
  movies: Movie[]
  totalPages: number
}

export type PopularMoviesParams = { slug: string; limit: number }

export type MovieImage = {
  url: string
  previewUrl?: string
}
