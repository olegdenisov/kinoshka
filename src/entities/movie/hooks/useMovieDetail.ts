import type { QueryBoundaryQuery } from '@shared/ui'

import {
  useGetMovieDetailQuery,
  useGetMovieImagesQuery,
} from '../api/movieDetailApi'
import type { MovieImage } from '../api/types'
import type { MovieDetail } from '../model/types'

type MovieDetailBundle = {
  detail: MovieDetail
  images: MovieImage[]
}

// Два запроса, один результат в форме query (для QueryBoundary). Ошибка картинок не роняет
// страницу — images: []; ошибка detail (включая 404) — ошибка всего bundle. currentData, а не
// data: при смене id RTK Query держит в data прошлый фильм, а на /movie/:id нужен скелетон.
// data появляется только когда images для этого id отработали, чтобы вкладка Media не мигала пустой
// сеткой. Условие — по currentData, а не по isFetching: фоновый перезапрос уже полученных картинок
// держит currentData и не должен прятать страницу за скелетон.
export const useMovieDetail = (
  id: number,
): QueryBoundaryQuery<MovieDetailBundle> & { isFetching: boolean } => {
  const detail = useGetMovieDetailQuery(id)
  const images = useGetMovieImagesQuery(id)

  const imagesSettled = images.currentData !== undefined || images.isError

  const data: MovieDetailBundle | undefined =
    detail.currentData && imagesSettled
      ? { detail: detail.currentData, images: images.currentData ?? [] }
      : undefined

  return {
    data,
    isLoading: detail.isLoading || images.isLoading,
    isFetching: detail.isFetching || images.isFetching,
    isError: detail.isError,
    error: detail.error,
    refetch: () => {
      detail.refetch()
      if (images.isError) images.refetch()
    },
  }
}
