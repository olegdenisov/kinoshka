import { topRatedMovies } from '@entities/movie'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const PersonalRails = reatomComponent(() => {
  const { isFirstPending } = topRatedMovies.status()

  return (
    <AsyncContent
      pending={isFirstPending}
      error={topRatedMovies.error()}
      onRetry={wrap(topRatedMovies.retry)}
      fallback={<MovieRailSkeleton />}
    >
      <MovieRail
        title='Because you watched Orbit of Silence'
        subtitle='Personal'
        items={topRatedMovies.data()}
      />
    </AsyncContent>
  )
}, 'PersonalRails')
