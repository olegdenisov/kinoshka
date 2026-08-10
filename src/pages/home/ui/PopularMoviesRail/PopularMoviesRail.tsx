import { useTopRatedMovies } from '@entities/movie'
import { MovieRailDesktop } from '@widgets/movie-rail'

export const PopularMoviesRail = () => {
  const popularMovies = useTopRatedMovies()
  return (
    <MovieRailDesktop
      title='Popular this week'
      subtitle='What everyone is watching'
      items={popularMovies}
    />
  )
}
