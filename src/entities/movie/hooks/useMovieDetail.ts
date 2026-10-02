import { movieDetailBundleStore } from '../api/getMovieDetailBundle'

export const useMovieDetail = (id: number) =>
  movieDetailBundleStore.useQuery(id)
