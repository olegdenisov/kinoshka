import { useTopRatedMovies } from "@entities/movie"
import { MovieRailDesktop } from "@widgets/movie-rail"

export const TrandingSeriesRail = () => {
   const series = useTopRatedMovies({ type: ['tv-series'] })
   return (
     <MovieRailDesktop
       title="Trending series"
       subtitle="Binge-worthy"
       items={series}
     />
   )
 }