import { topRatedAnime } from '@entities/movie'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const TopAnimeRails = reatomComponent(() => {
  const { isFirstPending } = topRatedAnime.status()

  return (
    <AsyncContent
      pending={isFirstPending}
      error={topRatedAnime.error()}
      onRetry={wrap(topRatedAnime.retry)}
      fallback={<MovieRailSkeleton />}
    >
      <MovieRail
        title='Top anime'
        subtitle='Hand-picked'
        items={topRatedAnime.data()}
      />
    </AsyncContent>
  )
}, 'TopAnimeRails')
