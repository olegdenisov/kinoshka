import type { MovieDtoV14 } from "@shared/api";
import type { Movie, MovieDetail, MovieType } from "../model/types";
import { mapDocToMovie } from "./mapDocToMovie";

export const mapDtoToMovieDetail = (doc: MovieDtoV14): MovieDetail => ({
  id: doc.id ?? 0,
  title: doc.name ?? doc.alternativeName ?? doc.enName ?? '',
  year: doc.year ?? undefined,
  rating: doc.rating?.kp ?? doc.rating?.imdb ?? 0,
  type: (doc.type ?? 'movie') as MovieType,
  genre: (doc.genres?.map((genre) => genre.name) ?? []) as Movie['genre'],
  runtime: String(doc.movieLength ?? 0),
  poster: doc.poster?.previewUrl ?? '',
  hue: 0,
  countries: doc.countries?.map((country) => country.name)
      .filter((name): name is string => !!name) 
    ?? [],
  similarMovies: doc.similarMovies?.map(mapDocToMovie) ?? [],
  cast: doc.persons?.map((cast) => ({
    id: cast.id ?? 0,
    name: cast.name ?? '',
    role: cast.profession ?? '',
  })) ?? [],
  crew: doc.crew?.map((crew) => ({
    id: crew.id ?? 0,
    name: crew.name ?? '',
    profession: crew.profession ?? '',
  })) ?? [],
  description: doc.description ?? '',
  shortDescription: doc.shortDescription ?? undefined,
  backdrop: doc.backdrop?.previewUrl ?? '',
  trailerUrl: doc.videos?.trailers?.map((trailer) => trailer.url).filter((url): url is string => !!url)[0],
  tagline: doc.slogan ?? '',
  ageRating: doc.ageRating ?? 0,
  ratingMpaa: doc.ratingMpaa ?? '',
  budget: doc.budget?.value ? { value: doc.budget.value ?? 0, currency: doc.budget.currency ?? '' } : undefined,
  feesWorld: doc.fees?.world ? {value: doc.fees.world.value ?? 0, currency: doc.fees.world.currency ?? ''} : undefined,
  criticReviewCount: doc.votes?.filmCritics ?? 0,
  criticScore: doc.rating?.filmCritics ?? 0,
  premiereWorld: doc.premiere?.world ?? undefined,
  votesKp: doc.votes?.kp ?? '',
  ratingImdb: doc.rating?.imdb ?? 0,
  ratingKp: doc.rating?.kp ?? 0,
})
