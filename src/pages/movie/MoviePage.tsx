import { invalidateMovieDetail, useMovieDetail } from '@entities/movie'
import { ApiError } from '@shared/api'
import { AsyncBoundary, ErrorState, type ErrorFallbackParams } from '@shared/ui'
import { useParams } from 'react-router'

import { Movie } from './ui/Movie'
import { MovieDetailSkeleton } from './ui/MovieDetailSkeleton'

const NOT_FOUND_TITLE = 'Movie not found'
const NOT_FOUND_DESCRIPTION = "This movie doesn't exist or was removed."

type MovieDetailContentProps = {
  id: number
}

const MovieDetailContent = ({ id }: MovieDetailContentProps) => {
  const { detail, images } = useMovieDetail(id)

  // key={id} ремаунтит Movie (и, значит, сбрасывает активный таб на Overview) при переходе
  // между разными фильмами — см. коммит 04cfa61 "reset movie tab on navigation". Раньше был
  // навешан на MovieDesktop/MovieMobile по отдельности, после слияния (Task 9 плана
  // docs/plans/20260827-mobile-first-adaptive-layout.md) — на едином Movie.
  return <Movie key={id} movie={detail} images={images} />
}

const movieErrorFallback = ({ error, reset }: ErrorFallbackParams) => {
  const isNotFound = error instanceof ApiError && error.status === 404

  return (
    <ErrorState
      title={isNotFound ? NOT_FOUND_TITLE : 'Something went wrong'}
      description={
        isNotFound
          ? NOT_FOUND_DESCRIPTION
          : error?.message || 'Please try again later'
      }
      onRetry={reset}
    />
  )
}

export const MoviePage = () => {
  const { id } = useParams<{ id: string }>()
  const numericId = Number(id)

  if (!id || !Number.isInteger(numericId) || numericId <= 0) {
    return (
      <ErrorState title={NOT_FOUND_TITLE} description={NOT_FOUND_DESCRIPTION} />
    )
  }

  return (
    <AsyncBoundary
      errorFallback={movieErrorFallback}
      fallback={<MovieDetailSkeleton />}
      onRetry={() => invalidateMovieDetail(numericId)}
    >
      <MovieDetailContent id={numericId} />
    </AsyncBoundary>
  )
}
