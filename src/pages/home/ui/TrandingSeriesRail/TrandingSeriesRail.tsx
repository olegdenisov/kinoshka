import { useNewMovies } from '@entities/movie'
import { QueryBoundary } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const TrandingSeriesRail = () => {
  const query = useNewMovies({ type: ['tv-series'] })
  return (
    <QueryBoundary query={query} fallback={<MovieRailSkeleton />}>
      {series => (
        <MovieRail
          title='Trending series'
          subtitle='Binge-worthy'
          items={series}
        />
      )}
    </QueryBoundary>
  )
}
