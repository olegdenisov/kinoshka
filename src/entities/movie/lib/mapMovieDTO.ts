import type { MovieDtoV14 } from "@shared/api";
import type { Movie } from "../model/types";

export const mapMovieDTO = (movie: MovieDtoV14): Movie => ({
  id: movie.id ?? 0,
  title: movie.name || '',
  year: movie.year ?? 0,
  rating: movie.rating?.kp ?? 0,
  type: (movie.type as Movie['type']) ?? 'movie',
  genre: movie.genres? movie.genres.flatMap(genre => genre.name ?? []) : [],
  runtime: movie.movieLength ? `${movie.movieLength} мин.` : '',
  hue: Math.random() * 360,
  poster: movie.poster?.previewUrl ?? '',
})