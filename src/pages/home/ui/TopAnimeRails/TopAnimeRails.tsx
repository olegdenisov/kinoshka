import { useTopRatedMovies } from "@entities/movie"
import { MovieRailDesktop } from "@widgets/movie-rail"

export const TopAnimeRails = () => {
   const series = useTopRatedMovies({ type: ['anime'] })
   return (
     <MovieRailDesktop
       title="Trending series"
       subtitle="Binge-worthy"
       items={series}
     />
   )
 }