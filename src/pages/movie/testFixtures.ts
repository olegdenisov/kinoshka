import type { MovieDetail, MovieImage } from '@entities/movie'

// Общие фикстуры для MovieDesktop.test.tsx и MovieMobile.test.tsx — оба компонента
// рендерят один и тот же MovieDetail-контракт, поэтому тестовые данные не дублируются.
export const MOVIE: MovieDetail = {
  id: 1,
  title: 'Orbit of Silence',
  year: 2024,
  rating: 8.4,
  type: 'movie',
  genre: ['Sci-Fi', 'Drama'],
  runtime: '2h 18m',
  hue: 18,
  poster: 'https://example.com/poster.jpg',
  tagline: "Some stories don't resolve.",
  synopsis: 'Full synopsis text about the observatory.',
  shortSynopsis: 'Short teaser synopsis.',
  trailerUrl: 'https://example.com/trailer',
  cast: [
    {
      id: 10,
      name: 'Liv Korhonen',
      role: 'Ines Varga',
      photo: 'https://example.com/liv.jpg',
    },
    { id: 11, name: 'Matteo Pereira', role: 'Arto Lind' },
  ],
  crew: [
    { id: 20, name: 'Hanna Vesper', profession: 'director' },
    { id: 21, name: 'Kasper Lind', profession: 'composer' },
  ],
  countries: ['Finland', 'Portugal'],
  ratingKp: 8.1,
  ratingImdb: 7.9,
  votesKp: '25k',
  criticScore: 85,
  criticReviewCount: 38,
  ageRating: 16,
  ratingMpaa: 'R',
  budget: { value: 4800000, currency: '$' },
  feesWorld: { value: 12300000, currency: '$' },
  premiereWorld: '2024-03-14',
  similarMovies: [
    {
      id: 2,
      title: 'The Quiet Archive',
      year: 2023,
      rating: 7.9,
      type: 'movie',
      genre: ['Drama'],
      runtime: '1h 52m',
      hue: 210,
    },
  ],
}

export const IMAGES: MovieImage[] = [
  {
    url: 'https://example.com/frame.jpg',
    previewUrl: 'https://example.com/frame-preview.jpg',
  },
]

// Фикстура со всеми опциональными полями MovieDetail отсутствующими — покрывает fallback-ветки
// ('—' плейсхолдеры, скрытые секции трейлера/скриншотов), которые MOVIE (все поля заполнены)
// никогда не задевает.
export const MOVIE_NO_OPTIONALS: MovieDetail = {
  id: 5,
  title: 'Bare Signal',
  rating: 0,
  type: 'movie',
  genre: ['Drama'],
  runtime: '1h 40m',
  hue: 40,
  tagline: 'A minimal tagline.',
  synopsis: 'Minimal synopsis text.',
  cast: [],
  crew: [],
  countries: [],
  similarMovies: [],
}
