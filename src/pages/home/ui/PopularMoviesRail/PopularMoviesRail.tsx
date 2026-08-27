import { usePopularMovies } from '@entities/movie'
import { MovieRail } from '@widgets/movie-rail'

export const PopularMoviesRail = () => {
  const popularMovies = usePopularMovies()
  return (
    <MovieRail
      title='Popular this week'
      subtitle='What everyone is watching'
      items={popularMovies}
      href='/popular'
    />
  )
}
