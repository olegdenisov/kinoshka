import { useTopRatedMovies } from '@entities/movie'
import { QueryBoundary } from '@shared/ui'
import { MovieRail, MovieRailSkeleton } from '@widgets/movie-rail'

export const PersonalRails = () => {
  const query = useTopRatedMovies()
  return (
    <QueryBoundary query={query} fallback={<MovieRailSkeleton />}>
      {movies => (
        <MovieRail
          title='Because you watched Orbit of Silence'
          subtitle='Personal'
          items={movies}
        />
      )}
    </QueryBoundary>
  )
}
