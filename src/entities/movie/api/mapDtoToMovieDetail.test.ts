import type { MovieDtoV14 } from '@shared/api'
import { isCast, isCrew, mapDtoToMovieDetail } from './mapDtoToMovieDetail'

const doc = (overrides: Partial<MovieDtoV14> = {}): MovieDtoV14 => ({
  id: 1,
  name: 'Test Movie',
  alternativeName: 'Тестовый фильм',
  enName: 'Test Movie EN',
  year: 2024,
  rating: { kp: 8.1, imdb: 7.9, filmCritics: 85 },
  type: 'movie',
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  backdrop: { previewUrl: 'https://example.com/backdrop.jpg' },
  slogan: "Some stories don't resolve.",
  description: 'Full synopsis text.',
  shortDescription: 'Short synopsis.',
  countries: [{ name: 'Finland' }, { name: 'Portugal' }],
  votes: { kp: '15.2K', filmCritics: 42 },
  ageRating: 16,
  ratingMpaa: 'pg13',
  budget: { value: 4_800_000, currency: '$' },
  fees: { world: { value: 12_300_000, currency: '$' } },
  premiere: { world: '2024-03-14' },
  videos: { trailers: [{ url: 'https://example.com/trailer.mp4' }] },
  similarMovies: [{ id: 2, name: 'Similar Movie' }],
  persons: [
    {
      id: 10,
      name: 'Liv Korhonen',
      description: 'Ines Varga',
      photo: 'https://example.com/liv.jpg',
      profession: 'актеры',
      enProfession: 'actor',
    },
    { id: 11, name: 'Hanna Vesper', profession: 'режиссеры', enProfession: 'director' },
    { id: 12, name: 'Unknown Person', profession: 'неизвестно', enProfession: 'stunt_coordinator' },
  ],
  ...overrides,
})

describe('mapDtoToMovieDetail — полностью заполненный doc', () => {
  it('маппит все поля в MovieDetail', () => {
    expect(mapDtoToMovieDetail(doc())).toEqual({
      id: 1,
      title: 'Test Movie',
      year: 2024,
      rating: 8.1,
      type: 'movie',
      genre: ['drama'],
      runtime: '120',
      poster: 'https://example.com/poster.jpg',
      hue: 0,
      tagline: "Some stories don't resolve.",
      synopsis: 'Full synopsis text.',
      shortSynopsis: 'Short synopsis.',
      backdrop: 'https://example.com/backdrop.jpg',
      trailerUrl: 'https://example.com/trailer.mp4',
      cast: [
        { id: 10, name: 'Liv Korhonen', role: 'Ines Varga', photo: 'https://example.com/liv.jpg' },
      ],
      crew: [{ id: 11, name: 'Hanna Vesper', profession: 'director' }],
      countries: ['Finland', 'Portugal'],
      ratingKp: 8.1,
      ratingImdb: 7.9,
      votesKp: '15.2K',
      criticScore: 85,
      criticReviewCount: 42,
      ageRating: 16,
      ratingMpaa: 'pg13',
      budget: { value: 4_800_000, currency: '$' },
      feesWorld: { value: 12_300_000, currency: '$' },
      premiereWorld: '2024-03-14',
      similarMovies: [
        {
          id: 2,
          title: 'Similar Movie',
          year: undefined,
          rating: 0,
          type: 'movie',
          genre: [],
          runtime: '0',
          poster: '',
          hue: 0,
        },
      ],
    })
  })
})

describe('mapDtoToMovieDetail — отсутствующие опциональные поля', () => {
  it('persons отсутствует — cast и crew пустые массивы', () => {
    const detail = mapDtoToMovieDetail(doc({ persons: undefined }))
    expect(detail.cast).toEqual([])
    expect(detail.crew).toEqual([])
  })

  it('genres/countries/similarMovies отсутствуют — пустые массивы', () => {
    const detail = mapDtoToMovieDetail(
      doc({ genres: undefined, countries: undefined, similarMovies: undefined }),
    )
    expect(detail.genre).toEqual([])
    expect(detail.countries).toEqual([])
    expect(detail.similarMovies).toEqual([])
  })

  it('description/shortDescription отсутствуют — synopsis пустая строка, shortSynopsis undefined', () => {
    const detail = mapDtoToMovieDetail(doc({ description: null, shortDescription: null }))
    expect(detail.synopsis).toBe('')
    expect(detail.shortSynopsis).toBeUndefined()
  })

  it('budget/fees без value — undefined, а не объект с нулями', () => {
    const detail = mapDtoToMovieDetail(
      doc({
        budget: { value: null, currency: '$' },
        fees: { world: { value: null, currency: '$' } },
      }),
    )
    expect(detail.budget).toBeUndefined()
    expect(detail.feesWorld).toBeUndefined()
  })

  it('videos.trailers отсутствуют — trailerUrl undefined', () => {
    expect(mapDtoToMovieDetail(doc({ videos: undefined })).trailerUrl).toBeUndefined()
  })

  it('rating/votes целиком отсутствуют — соответствующие поля undefined', () => {
    const detail = mapDtoToMovieDetail(doc({ rating: undefined, votes: undefined }))
    expect(detail.ratingKp).toBeUndefined()
    expect(detail.ratingImdb).toBeUndefined()
    expect(detail.criticScore).toBeUndefined()
    expect(detail.votesKp).toBeUndefined()
    expect(detail.criticReviewCount).toBeUndefined()
  })
})

describe('isCast / isCrew — фильтрация по enProfession', () => {
  it('actor попадает в cast, но не в crew', () => {
    const actor = { id: 1, enProfession: 'actor' }
    expect(isCast(actor)).toBe(true)
    expect(isCrew(actor)).toBe(false)
  })

  it.each(['director', 'writer', 'producer', 'composer', 'operator'])(
    '%s попадает в crew, но не в cast',
    (profession) => {
      const person = { id: 1, enProfession: profession }
      expect(isCrew(person)).toBe(true)
      expect(isCast(person)).toBe(false)
    },
  )

  it('неизвестная профессия — не попадает ни в cast, ни в crew', () => {
    const person = { id: 1, enProfession: 'stunt_coordinator' }
    expect(isCast(person)).toBe(false)
    expect(isCrew(person)).toBe(false)
  })

  it('enProfession отсутствует — не попадает ни в cast, ни в crew', () => {
    const person = { id: 1, enProfession: null }
    expect(isCast(person)).toBe(false)
    expect(isCrew(person)).toBe(false)
  })
})
