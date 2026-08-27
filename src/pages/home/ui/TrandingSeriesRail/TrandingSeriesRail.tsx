import { useNewMovies } from '@entities/movie'
import { MovieRail } from '@widgets/movie-rail'

export const TrandingSeriesRail = () => {
  const series = useNewMovies({ type: ['tv-series'] })
  return (
    <MovieRail title='Trending series' subtitle='Binge-worthy' items={series} />
  )
}
