import { useTopRatedMovies } from '@entities/movie'
import { MovieRail } from '@widgets/movie-rail'

export const PersonalRails = () => {
  const movies = useTopRatedMovies()
  return (
    <MovieRail
      title='Because you watched Orbit of Silence'
      subtitle='Personal'
      items={movies}
    />
  )
}
