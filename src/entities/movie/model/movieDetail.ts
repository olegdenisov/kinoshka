import { action, withAsync, wrap } from '@reatom/core'
import { apiClient, ApiError } from '@shared/api'
import { withQueryCache } from '@shared/lib'

import { mapDtoToMovieDetail } from '../api/mapDtoToMovieDetail'
import type { MovieDetail } from './types'

export type MovieImage = {
  url: string
  previewUrl?: string
}

export type MovieDetailBundle = {
  detail: MovieDetail
  images: MovieImage[]
}

// Без wrap вокруг запроса: с ignoreAbort один промис делят все вызывающие, и отмена первого
// (смена набора id, уход со страницы) не должна ронять запрос остальным. Вызывающий сам
// оборачивает результат в wrap, а после await здесь атомы не читаются.
export const fetchMovieDetail = action(
  async (id: number): Promise<MovieDetail> => {
    const response = await apiClient.getV15MovieById({ path: { id } })

    if ('statusCode' in response.data) {
      // нужно чтобы сузить тип
      throw new ApiError(response.data.message, response.data.statusCode)
    }

    return mapDtoToMovieDetail(response.data)
  },
  'movie.fetchDetail',
).extend(withAsync(), withQueryCache({ length: 100, ignoreAbort: true }))

const fetchMovieImages = action(async (id: number): Promise<MovieImage[]> => {
  const response = await apiClient.getV15Image({
    query: {
      movieId: [String(id)],
      type: ['frame', 'screenshot'],
      limit: 8,
      selectFields: ['url', 'previewUrl'],
    },
  })

  if (!('docs' in response.data)) {
    // нужно чтобы сузить тип
    return []
  }

  return response.data.docs
    .filter((image): image is typeof image & { url: string } => !!image.url)
    .map(image => ({
      url: image.url,
      previewUrl: image.previewUrl ?? undefined,
    }))
}, 'movie.fetchImages').extend(
  withAsync(),
  withQueryCache({ length: 100, ignoreAbort: true }),
)

// Деталь обязательна, картинки — украшение: их отказ не ломает страницу фильма.
export const loadMovieDetailBundle = async (
  id: number,
): Promise<MovieDetailBundle> => {
  const [detailResult, imagesResult] = await wrap(
    Promise.allSettled([fetchMovieDetail(id), fetchMovieImages(id)]),
  )

  if (detailResult.status === 'rejected') {
    throw detailResult.reason
  }

  return {
    detail: detailResult.value,
    images: imagesResult.status === 'fulfilled' ? imagesResult.value : [],
  }
}
