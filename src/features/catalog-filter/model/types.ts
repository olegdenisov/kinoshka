import type { Duration } from '../lib/filterOptions'

export type FilterState = {
  type: string | null
  genres: string[]
  yearFrom: number | null
  yearTo: number | null
  rating: number | null
  countries: string[]
  duration: Duration | null
  platforms: string[]
  list: string | null
}

/** UI type-фильтр → лейбл chip'а — те же подписи, что у Header nav pills и SearchSidebar. */
export const TYPE_LABELS: Record<string, string> = {
  movie: 'Movies',
  series: 'Series',
  anime: 'Anime',
}
