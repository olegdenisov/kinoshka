import { use } from "react"
import { getMovies } from "../api/getMovies"

export const useMoviesByGenre = (genre: string) => {
  const result = use(getMovies({
    "genres.name": [genre]
  }))

  return result
}