import type { Movie, MovieType } from "../model/types";

// Общая форма doc-элемента, покрывающая и v1.5 (`MovieDtoV14`, docs `getV15Movie`),
// и v1.4 (`SearchMovieDtoV14`, docs `getV14MovieSearch`) — структурно совместимое подмножество полей.
export type MovieDocLike = {
  id?: number | null;
  name?: string | null;
  alternativeName?: string | null;
  enName?: string | null;
  year?: number | null;
  rating?: {
    kp?: number | null;
    imdb?: number | null;
  } | null;
  type?: string | null;
  genres?: Array<{ name?: string | null }> | null;
  movieLength?: number | null;
  poster?: { previewUrl?: string | null } | null;
}

export const mapDocToMovie = (doc: MovieDocLike): Movie => ({
  id: doc.id || 0,
  title: doc.name ?? doc.alternativeName ?? doc.enName ?? '',
  year: doc.year ?? undefined,
  rating: doc.rating?.kp ?? doc.rating?.imdb ?? 0,
  type: (doc.type || 'movie') as MovieType,
  genre: (doc.genres?.map((genre) => genre.name) || []) as Movie['genre'],
  runtime: String(doc.movieLength ?? 0),
  poster: doc.poster?.previewUrl || '',
  hue: 0,
})
