import { usePopularMovies } from '@entities/movie'
import { QueryBoundary } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const PopularMoviesRail = () => {
  const query = usePopularMovies()
  return (
    <QueryBoundary query={query} fallback={<MovieRailSkeleton />}>
      {popularMovies => (
        <MovieRail
          title='Popular this week'
          subtitle='What everyone is watching'
          items={popularMovies}
          href='/popular'
        />
      )}
    </QueryBoundary>
  )
}
