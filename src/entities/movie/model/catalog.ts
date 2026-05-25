import type { Movie, MovieDetail } from './types'

export const CATALOG: Movie[] = [
  { id: 1, title: 'Orbit of Silence', year: 2024, rating: 8.4, type: 'movie', genre: ['Sci-Fi', 'Drama'], runtime: '2h 18m', hue: 18 },
  { id: 2, title: 'The Quiet Archive', year: 2023, rating: 7.9, type: 'movie', genre: ['Drama'], runtime: '1h 52m', hue: 210 },
  { id: 3, title: 'Paper Lanterns', year: 2025, rating: 8.1, type: 'anime', genre: ['Fantasy', 'Adventure'], runtime: '12 ep', hue: 340 },
  { id: 4, title: 'North of Midnight', year: 2024, rating: 7.6, type: 'series', genre: ['Thriller'], runtime: '3 seasons', hue: 220 },
  { id: 5, title: 'Ember & Ash', year: 2025, rating: 8.7, type: 'movie', genre: ['Romance', 'Drama'], runtime: '2h 04m', hue: 24 },
  { id: 6, title: 'Hollow Cities', year: 2023, rating: 7.2, type: 'series', genre: ['Mystery'], runtime: '2 seasons', hue: 260 },
  { id: 7, title: 'Saltwater Ghosts', year: 2024, rating: 8.0, type: 'movie', genre: ['Horror'], runtime: '1h 44m', hue: 190 },
  { id: 8, title: 'Tokyo at Dawn', year: 2024, rating: 9.1, type: 'anime', genre: ['Slice of Life'], runtime: '24 ep', hue: 12 },
  { id: 9, title: 'A Study in Weather', year: 2022, rating: 7.4, type: 'movie', genre: ['Documentary'], runtime: '1h 28m', hue: 170 },
  { id: 10, title: 'Lantern Street', year: 2025, rating: 8.3, type: 'series', genre: ['Drama'], runtime: '1 season', hue: 35 },
  { id: 11, title: 'Glasswater', year: 2023, rating: 7.8, type: 'movie', genre: ['Thriller', 'Drama'], runtime: '2h 02m', hue: 200 },
  { id: 12, title: 'Nightingale Theory', year: 2024, rating: 8.6, type: 'movie', genre: ['Sci-Fi'], runtime: '2h 26m', hue: 280 },
  { id: 13, title: 'Little Weather', year: 2025, rating: 7.5, type: 'anime', genre: ['Family'], runtime: '13 ep', hue: 50 },
  { id: 14, title: 'The Last Correspondent', year: 2022, rating: 8.2, type: 'movie', genre: ['Historical'], runtime: '2h 10m', hue: 30 },
  { id: 15, title: 'Signal / Noise', year: 2024, rating: 7.9, type: 'series', genre: ['Thriller'], runtime: '1 season', hue: 240 },
  { id: 16, title: 'Houses Made of Rain', year: 2023, rating: 8.0, type: 'movie', genre: ['Drama'], runtime: '1h 58m', hue: 150 },
  { id: 17, title: 'Phosphor', year: 2025, rating: 7.7, type: 'anime', genre: ['Action'], runtime: '24 ep', hue: 5 },
  { id: 18, title: 'The Cartographer', year: 2024, rating: 8.5, type: 'movie', genre: ['Adventure'], runtime: '2h 14m', hue: 40 },
]

export const MOCK_DETAIL: Omit<MovieDetail, keyof Movie> = {
  tagline: "Some stories don't resolve. They just quiet down.",
  synopsis: `Dr. Ines Varga returns to the Hallesk Ridge observatory after a two-decade absence.
What was once her life's work is now a ghost station — rusted dishes, forgotten tapes, a younger
colleague who inherited her silence. When the old array starts receiving a rhythmic pulse from
an empty patch of sky, the two are forced to decide whether to listen, transmit, or run.`,
  cast: [
    { name: 'Ines Varga', actor: 'Liv Korhonen', hue: 20 },
    { name: 'Arto Lind', actor: 'Matteo Pereira', hue: 200 },
    { name: 'Young Ines', actor: 'Hana Tokumi', hue: 340 },
    { name: 'The Operator', actor: 'Samuel Orell', hue: 50 },
    { name: 'Anya', actor: 'Ruth Adeyemi', hue: 260 },
    { name: 'Father', actor: 'Erik Solberg', hue: 170 },
  ],
  crew: {
    director: 'Hanna Vesper',
    writer: 'Hanna Vesper, M. Orell',
    composer: 'Kasper Lind',
    studio: 'North Pillar Films',
  },
  signals: {
    criticalConsensus: 'Quiet stunner',
    audience: 'Polarizing · 68%',
    pacing: 'Slow',
    mood: 'Contemplative',
    violence: 'Mild',
    tearRisk: 'High',
  },
  details: {
    releaseDate: 'March 14, 2024',
    country: 'Finland · Portugal',
    language: 'English · Finnish · Portuguese',
    aspectRatio: '2.39 : 1',
    soundMix: 'Dolby Atmos',
    budget: '$4.8M (est.)',
    boxOffice: '$12.3M worldwide',
  },
  criticScore: '85%',
  criticReviews: 38,
  userVotes: '25k',
}

export const ALL_GENRES = [
  'Action', 'Drama', 'Sci-Fi', 'Thriller', 'Romance', 'Horror',
  'Mystery', 'Documentary', 'Historical', 'Adventure', 'Family', 'Slice of Life', 'Fantasy',
]
