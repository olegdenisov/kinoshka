export type MovieType = 'movie' | 'tv-series' | 'cartoon' | 'anime' | 'animated-series'

export type Movie = {
  id: number
  title: string
  year: number
  rating: number
  type: MovieType
  genre: string[]
  runtime: string
  hue: number
}

export type CastMember = {
  name: string
  actor: string
  hue: number
}

export type MovieDetail = Movie & {
  tagline: string
  synopsis: string
  cast: CastMember[]
  crew: {
    director: string
    writer: string
    composer: string
    studio: string
  }
  signals: {
    criticalConsensus: string
    audience: string
    pacing: string
    mood: string
    violence: string
    tearRisk: string
  }
  details: {
    releaseDate: string
    country: string
    language: string
    aspectRatio: string
    soundMix: string
    budget: string
    boxOffice: string
  }
  criticScore: string
  criticReviews: number
  userVotes: string
}
