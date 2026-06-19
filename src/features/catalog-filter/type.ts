import type { MovieType } from "@entities/movie"

export type FilterState = {
  type: MovieType | null
  genres: string[]
  yearFrom: number | null
  yearTo: number | null
  rating: number | null
  q: string | null
}