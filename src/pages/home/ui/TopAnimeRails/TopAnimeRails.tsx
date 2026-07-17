import { useTopRatedMovies } from "@entities/movie"
import { MovieRailDesktop } from "@widgets/movie-rail"

export const TopAnimeRails = () => {
   const series = useTopRatedMovies({ type: ['anime'] })
   return (
     <MovieRailDesktop
       title="Top anime"
       subtitle="Hand-picked"
       items={series}
     />
   )
 }