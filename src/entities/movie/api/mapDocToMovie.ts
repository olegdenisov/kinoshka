import { hashHue } from '../lib/hashHue'
import type { Movie, MovieType } from '../model/types'

// Общая форма doc-элемента, покрывающая и `getV15Movie` (`MovieDtoV14`),
// и `getV15MovieSearch` (`SearchMovieDtoV14`) — структурно совместимое подмножество полей.
export type MovieDocLike = {
  id?: number | null
  name?: string | null
  alternativeName?: string | null
  enName?: string | null
  year?: number | null
  rating?: {
    kp?: number | null
    imdb?: number | null
  } | null
  type?: string | null
  genres?: Array<{ name?: string | null }> | null
  movieLength?: number | null
  poster?: { previewUrl?: string | null } | null
}

export const mapDocToMovie = (doc: MovieDocLike): Movie => ({
  id: doc.id ?? 0,
  title: doc.name ?? doc.alternativeName ?? doc.enName ?? '',
  year: doc.year ?? undefined,
  rating: doc.rating?.kp ?? doc.rating?.imdb ?? 0,
  type: (doc.type ?? 'movie') as MovieType,
  genre: (doc.genres?.map(genre => genre.name) ?? []) as Movie['genre'],
  runtime: String(doc.movieLength ?? 0),
  poster: doc.poster?.previewUrl ?? '',
  hue: hashHue(doc.id ?? 0),
})
