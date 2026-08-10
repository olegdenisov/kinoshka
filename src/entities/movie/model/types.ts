export type MovieType = 'movie' | 'tv-series' | 'cartoon' | 'anime' | 'animated-series'

export type Movie = {
  id: number
  title: string
  rating: number
  type: MovieType
  genre: string[]
  runtime: string
  hue: number
  year?: number
  poster?: string
}

export type CastMember = {
  id: number
  name: string
  role: string
  photo?: string
}

export type CrewMember = {
  id: number
  name: string
  profession: string
}

export type MovieDetail = Movie & {
  tagline: string
  synopsis: string
  shortSynopsis?: string
  backdrop?: string
  trailerUrl?: string
  cast: CastMember[]
  crew: CrewMember[]
  countries: string[]
  ratingKp?: number
  ratingImdb?: number
  votesKp?: string
  criticScore?: number         // rating.filmCritics
  criticReviewCount?: number   // votes.filmCritics
  ageRating?: number
  ratingMpaa?: string
  budget?: { value: number; currency: string }
  feesWorld?: { value: number; currency: string }
  premiereWorld?: string
  similarMovies: Movie[]
}
