import { createQueryStore } from '@shared/lib'

import type { MovieDetail } from '../model/types'
import { movieDetailStore } from './getMovieDetail'
import { fetchMovieImages, type MovieImage } from './getMovieImages'

type MovieDetailBundle = {
  detail: MovieDetail
  images: MovieImage[]
}

const fetchMovieDetailBundle = async (
  id: number,
): Promise<MovieDetailBundle> => {
  // detail — именно через стор: кеш общий с getMoviesByIds
  const [detailResult, imagesResult] = await Promise.allSettled([
    movieDetailStore.fetch(id),
    fetchMovieImages(id),
  ])

  // detail отклонён (включая 404) → ошибка всей страницы; картинки — второстепенны
  if (detailResult.status === 'rejected') {
    throw detailResult.reason
  }

  return {
    detail: detailResult.value,
    images: imagesResult.status === 'fulfilled' ? imagesResult.value : [],
  }
}

export const movieDetailBundleStore = createQueryStore({
  name: 'movieDetailBundle',
  fetcher: fetchMovieDetailBundle,
})
