import { popularMovies } from '@entities/movie'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const PopularMoviesRail = reatomComponent(() => {
  const { isFirstPending } = popularMovies.status()

  return (
    <AsyncContent
      pending={isFirstPending}
      error={popularMovies.error()}
      onRetry={wrap(popularMovies.retry)}
      fallback={<MovieRailSkeleton />}
    >
      <MovieRail
        title='Popular this week'
        subtitle='What everyone is watching'
        items={popularMovies.data()}
        href='/popular'
      />
    </AsyncContent>
  )
}, 'PopularMoviesRail')
