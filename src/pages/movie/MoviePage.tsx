import type { MovieDetailBundle } from '@entities/movie'
import type { RouteLoader } from '@reatom/core'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { ApiError } from '@shared/api'
import { AsyncContent, ErrorState } from '@shared/ui'

import { Movie } from './ui/Movie'
import { MovieDetailSkeleton } from './ui/MovieDetailSkeleton'

const NOT_FOUND_TITLE = 'Movie not found'
const NOT_FOUND_DESCRIPTION = "This movie doesn't exist or was removed."

type MoviePageProps = {
  loader: RouteLoader<{ id: string }, MovieDetailBundle>
}

export const MoviePage = reatomComponent(({ loader }: MoviePageProps) => {
  const bundle = loader.data()
  const error = loader.error()
  // loader.data() не очищается при смене :id, поэтому «идёт загрузка» берём из ready(), а не
  // из отсутствия данных — иначе на /movie/1 → /movie/2 мелькнул бы фильм 1.
  const pending = !loader.ready() || (!bundle && !error)

  return (
    <AsyncContent
      pending={pending}
      error={error}
      onRetry={wrap(loader.retry)}
      fallback={<MovieDetailSkeleton />}
      errorFallback={({ error: err, retry }) => {
        const isNotFound = err instanceof ApiError && err.status === 404

        return (
          <ErrorState
            title={isNotFound ? NOT_FOUND_TITLE : 'Something went wrong'}
            description={
              isNotFound
                ? NOT_FOUND_DESCRIPTION
                : err.message || 'Please try again later'
            }
            onRetry={retry}
          />
        )
      }}
    >
      {bundle && (
        // key сбрасывает активный таб Movie при переходе между разными фильмами.
        <Movie
          key={bundle.detail.id}
          movie={bundle.detail}
          images={bundle.images}
        />
      )}
    </AsyncContent>
  )
}, 'MoviePage')
