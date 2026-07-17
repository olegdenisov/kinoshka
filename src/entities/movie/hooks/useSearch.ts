import { use } from "react"
import { getSearchMovies } from "../api/getSearchMovies"

export const useSearch = (params: { query: string, page?: number }) => {
  const result = use(getSearchMovies({
    ...params,
  }))

  return result
}