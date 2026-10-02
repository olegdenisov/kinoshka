import { useGetPopularMoviesQuery } from '../api/catalogApi'

const POPULAR_PARAMS = { slug: 'popular', limit: 10 }

export const usePopularMovies = () => useGetPopularMoviesQuery(POPULAR_PARAMS)
