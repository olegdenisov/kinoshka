import { useParams } from 'react-router'
import { useViewport } from '@shared/lib'
import { useMovieDetail } from '@entities/movie'
import { ApiError } from '@shared/api'
import { AsyncBoundary, ErrorState, type ErrorFallbackParams } from '@shared/ui'
import { MovieDesktop } from './ui/MovieDesktop'
import { MovieMobile } from './ui/MovieMobile'
import { MovieDetailSkeleton } from './ui/MovieDetailSkeleton'

const NOT_FOUND_TITLE = 'Movie not found'
const NOT_FOUND_DESCRIPTION = "This movie doesn't exist or was removed."

type MovieDetailContentProps = {
  id: number
  isMobile: boolean
}

const MovieDetailContent = ({ id, isMobile }: MovieDetailContentProps) => {
  const { detail, images } = useMovieDetail(id)

  return isMobile ? <MovieMobile movie={detail} images={images} /> : <MovieDesktop movie={detail} images={images} />
}

const movieErrorFallback = ({ error, reset }: ErrorFallbackParams) => {
  const isNotFound = error instanceof ApiError && error.status === 404

  return (
    <ErrorState
      title={isNotFound ? NOT_FOUND_TITLE : 'Something went wrong'}
      description={isNotFound ? NOT_FOUND_DESCRIPTION : error?.message || 'Please try again later'}
      onRetry={reset}
    />
  )
}

export const MoviePage = () => {
  const { id } = useParams<{ id: string }>()
  const { isMobile } = useViewport()
  const numericId = Number(id)

  if (!id || !Number.isInteger(numericId) || numericId <= 0) {
    return <ErrorState title={NOT_FOUND_TITLE} description={NOT_FOUND_DESCRIPTION} />
  }

  return (
    <AsyncBoundary errorFallback={movieErrorFallback} fallback={<MovieDetailSkeleton />}>
      <MovieDetailContent id={numericId} isMobile={isMobile} />
    </AsyncBoundary>
  )
}
