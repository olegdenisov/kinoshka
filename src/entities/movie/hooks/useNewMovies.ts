import { use } from "react"
import { getMovies } from "../api/getMovies"
import type { MovieType } from "../model/types"

export const useNewMovies = (params?: { type: MovieType[] }) => {
  const result = use(
    getMovies({
      ...params,
      year: [new Date().getFullYear().toString()],
    }),
  )

  return result
}
