import { useGetMovieDetailQuery, useGetMovieImagesQuery } from '../api/movieApi'
import type { MovieImage } from '../api/movieApi'
import type { MovieDetail } from '../model/types'

export type MovieDetailBundle = {
  detail: MovieDetail
  images: MovieImage[]
}

// Два запроса, один результат в форме query (для QueryBoundary). Ошибка картинок не роняет
// страницу — images: []; ошибка detail (включая 404) — ошибка всего bundle. currentData, а не
// data: при смене id RTK Query держит в data прошлый фильм, а на /movie/:id нужен скелетон.
// data появляется только когда images отработали, чтобы вкладка Media не мигала пустой сеткой.
export const useMovieDetail = (id: number) => {
  const detail = useGetMovieDetailQuery(id)
  const images = useGetMovieImagesQuery(id)

  const data: MovieDetailBundle | undefined =
    detail.currentData && !images.isLoading && !images.isFetching
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
