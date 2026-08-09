import type { MovieDtoV14, PersonInMovie } from "@shared/api";
import type { MovieDetail } from "../model/types";
import { mapDocToMovie } from "./mapDocToMovie";

const CAST_PROFESSIONS = new Set(['actor'])
const CREW_PROFESSIONS = new Set(['director', 'writer', 'producer', 'composer', 'operator'])

export const isCast = (person: PersonInMovie): boolean => (
  CAST_PROFESSIONS.has(person.enProfession ?? '')
)

export const isCrew = (person: PersonInMovie): boolean => (
  CREW_PROFESSIONS.has(person.enProfession ?? '')
)

export const mapDtoToMovieDetail = (doc: MovieDtoV14): MovieDetail => ({
  ...mapDocToMovie(doc),
  tagline: doc.slogan ?? '',
  synopsis: doc.description ?? '',
  shortSynopsis: doc.shortDescription ?? undefined,
  backdrop: doc.backdrop?.previewUrl ?? undefined,
  trailerUrl: doc.videos?.trailers?.map((trailer) => trailer.url).filter((url): url is string => !!url)[0],
  cast: doc.persons?.filter(isCast).map((person) => ({
    id: person.id,
    name: person.name ?? '',
    role: person.description ?? '',
    photo: person.photo ?? undefined,
  })) ?? [],
  crew: doc.persons?.filter(isCrew).map((person) => ({
    id: person.id,
    name: person.name ?? '',
    profession: person.profession ?? '',
  })) ?? [],
  countries: doc.countries?.map((country) => country.name).filter((name): name is string => !!name) ?? [],
  ratingKp: doc.rating?.kp ?? undefined,
  ratingImdb: doc.rating?.imdb ?? undefined,
  votesKp: doc.votes?.kp ?? undefined,
  criticScore: doc.rating?.filmCritics ?? undefined,
  criticReviewCount: doc.votes?.filmCritics ?? undefined,
  ageRating: doc.ageRating ?? undefined,
  ratingMpaa: doc.ratingMpaa ?? undefined,
  budget: doc.budget?.value != null ? { value: doc.budget.value, currency: doc.budget.currency ?? '' } : undefined,
  feesWorld: doc.fees?.world?.value != null ? { value: doc.fees.world.value, currency: doc.fees.world.currency ?? '' } : undefined,
  premiereWorld: doc.premiere?.world ?? undefined,
  similarMovies: doc.similarMovies?.map(mapDocToMovie) ?? [],
})
