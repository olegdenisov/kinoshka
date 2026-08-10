import { useTopRatedMovies } from "@entities/movie"
import { MovieRailDesktop } from "@widgets/movie-rail"

export const PersonalRails = () => {
  const movies = useTopRatedMovies()
  return (
    <MovieRailDesktop
      title="Because you watched Orbit of Silence"
      subtitle="Personal"
      items={movies}
    />
  )
}
