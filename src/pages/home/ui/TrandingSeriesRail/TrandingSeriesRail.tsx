import { newSeries } from '@entities/movie'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const TrandingSeriesRail = reatomComponent(() => {
  const { isFirstPending } = newSeries.status()

  return (
    <AsyncContent
      pending={isFirstPending}
      error={newSeries.error()}
      onRetry={wrap(newSeries.retry)}
      fallback={<MovieRailSkeleton />}
    >
      <MovieRail
        title='Trending series'
        subtitle='Binge-worthy'
        items={newSeries.data()}
      />
    </AsyncContent>
  )
}, 'TrandingSeriesRail')
