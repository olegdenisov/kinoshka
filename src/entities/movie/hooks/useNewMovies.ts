import { use } from "react"
import { getMovies } from "../api/getMovies"

export const useNewMovies = () => {
  const result = use(getMovies({
    year: [new Date().getFullYear().toString()]
  }))

  return result
}