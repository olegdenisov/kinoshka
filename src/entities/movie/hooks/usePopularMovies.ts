import { popularMoviesQueryStore } from '../api/getPopularMovies'

const POPULAR_PARAMS = { slug: 'popular', limit: 10 }

export const usePopularMovies = () =>
  popularMoviesQueryStore.useQuery(POPULAR_PARAMS)
