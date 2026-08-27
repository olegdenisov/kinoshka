import { useTopRatedMovies } from '@entities/movie'
import { MovieRail } from '@widgets/movie-rail'

export const TopAnimeRails = () => {
  const series = useTopRatedMovies({ type: ['anime'] })
  return <MovieRail title='Top anime' subtitle='Hand-picked' items={series} />
}
