import { useTopRatedMovies } from '@entities/movie'
import { QueryBoundary } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const TopAnimeRails = () => {
  const query = useTopRatedMovies({ type: ['anime'] })
  return (
    <QueryBoundary query={query} fallback={<MovieRailSkeleton />}>
      {series => (
        <MovieRail title='Top anime' subtitle='Hand-picked' items={series} />
      )}
    </QueryBoundary>
  )
}
