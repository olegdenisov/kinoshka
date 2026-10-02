import { popularMoviesStore } from '../api/getPopularMovies'

const POPULAR_PARAMS = { slug: 'popular', limit: 10 }

export const usePopularMovies = () =>
  popularMoviesStore.useQuery(POPULAR_PARAMS)
