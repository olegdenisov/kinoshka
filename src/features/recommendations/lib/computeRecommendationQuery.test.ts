import type { Movie } from '@entities/movie'

import { computeRecommendationQuery } from './computeRecommendationQuery'

const movie = (overrides: Partial<Movie> & { id: number }): Movie => ({
  title: `Movie ${overrides.id}`,
  rating: 0,
  type: 'movie',
  genre: [],
  runtime: '1h 30m',
  hue: 0,
  ...overrides,
})

describe('computeRecommendationQuery', () => {
  it('пустой favorites → null', () => {
    expect(computeRecommendationQuery([])).toBeNull()
  })

  it('топ-3 жанра по частоте среди >3 уникальных жанров', () => {
    const favorites = [
      movie({ id: 1, genre: ['драма', 'комедия'] }),
      movie({ id: 2, genre: ['драма', 'боевик'] }),
      movie({ id: 3, genre: ['драма', 'фантастика'] }),
      movie({ id: 4, genre: ['комедия', 'боевик'] }),
      movie({ id: 5, genre: ['ужасы'] }),
    ]

    const params = computeRecommendationQuery(favorites)

    // драма: 3, комедия: 2, боевик: 2 (оба раньше фантастики/ужасов по первому появлению)
    expect(params?.['genres.name']).toEqual(['драма', 'комедия', 'боевик'])
  })

  it('ties по частоте — порядок по первому появлению жанра', () => {
    const favorites = [
      movie({ id: 1, genre: ['b'] }),
      movie({ id: 2, genre: ['a'] }),
      movie({ id: 3, genre: ['c'] }),
    ]

    const params = computeRecommendationQuery(favorites)

    expect(params?.['genres.name']).toEqual(['b', 'a', 'c'])
  })

  it('средний рейтинг с буфером −1', () => {
    const favorites = [movie({ id: 1, rating: 8 }), movie({ id: 2, rating: 6 })]

    const params = computeRecommendationQuery(favorites)

    // avg = 7, floor = 6.0
    expect(params?.['rating.kp']).toEqual(['6.0-10'])
  })

  it('кламп ratingFloor к 0 при низком среднем', () => {
    const favorites = [movie({ id: 1, rating: 0.5 })]

    const params = computeRecommendationQuery(favorites)

    // avg = 0.5, floor = max(0, -0.5) = 0
    expect(params?.['rating.kp']).toEqual(['0.0-10'])
  })

  it('id содержит "!<id>" для каждого избранного', () => {
    const favorites = [
      movie({ id: 10, rating: 5 }),
      movie({ id: 20, rating: 5 }),
    ]

    const params = computeRecommendationQuery(favorites)

    expect(params?.id).toEqual(['!10', '!20'])
  })

  it('sortField/sortType присутствуют всегда', () => {
    const favorites = [movie({ id: 1 })]

    const params = computeRecommendationQuery(favorites)

    expect(params?.sortField).toEqual(['rating.kp'])
    expect(params?.sortType).toEqual(['-1'])
  })

  it('фильм без жанров не ломает подсчёт (просто не вносит вклад)', () => {
    const favorites = [
      movie({ id: 1, genre: [] }),
      movie({ id: 2, genre: ['драма'] }),
    ]

    const params = computeRecommendationQuery(favorites)

    expect(params?.['genres.name']).toEqual(['драма'])
  })

  it('фильм с rating: 0 пропускается при подсчёте среднего, а не считается за 0', () => {
    const favorites = [
      movie({ id: 1, rating: 0 }),
      movie({ id: 2, rating: 10 }),
    ]

    const params = computeRecommendationQuery(favorites)

    // avg по ratedFavorites (только id: 2) = 10, floor = 9
    expect(params?.['rating.kp']).toEqual(['9.0-10'])
  })

  it('все избранные фильмы без рейтинга → "rating.kp" не добавляется', () => {
    const favorites = [movie({ id: 1, rating: 0 }), movie({ id: 2, rating: 0 })]

    const params = computeRecommendationQuery(favorites)

    expect(params).not.toHaveProperty('rating.kp')
  })

  it('все избранные фильмы без жанров → "genres.name" не добавляется', () => {
    const favorites = [movie({ id: 1, genre: [] }), movie({ id: 2, genre: [] })]

    const params = computeRecommendationQuery(favorites)

    expect(params).not.toHaveProperty('genres.name')
  })

  it('результат никогда не содержит поле limit', () => {
    const favorites = [movie({ id: 1, rating: 7, genre: ['драма'] })]

    const params = computeRecommendationQuery(favorites)

    expect(params).not.toHaveProperty('limit')
  })

  it('результат никогда не содержит поле type', () => {
    const favorites = [
      movie({ id: 1, rating: 7, genre: ['драма'], type: 'cartoon' }),
    ]

    const params = computeRecommendationQuery(favorites)

    expect(params).not.toHaveProperty('type')
  })

  it('дубликат жанра внутри genre одного избранного фильма учитывается дважды при подсчёте частоты', () => {
    const favorites = [
      movie({ id: 1, genre: ['драма', 'драма', 'комедия'] }),
      movie({ id: 2, genre: ['комедия'] }),
    ]

    const params = computeRecommendationQuery(favorites)

    // драма: 2 (из-за дубликата внутри одного фильма), комедия: 2 — при равенстве
    // порядок по первому появлению жанра ставит "драма" раньше "комедия"
    expect(params?.['genres.name']).toEqual(['драма', 'комедия'])
  })
})
