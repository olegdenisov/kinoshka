import { mapDocToMovie, type MovieDocLike } from './mapDocToMovie'

const doc = (overrides: Partial<MovieDocLike> = {}): MovieDocLike => ({
  id: 1,
  name: 'Test Movie',
  alternativeName: 'Тестовый фильм',
  enName: 'Test Movie EN',
  year: 2024,
  rating: { kp: 8.1, imdb: 7.9 },
  type: 'movie',
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  ...overrides,
})

describe('mapDocToMovie — полностью заполненный doc', () => {
  it('маппит все поля в Movie', () => {
    expect(mapDocToMovie(doc())).toEqual({
      id: 1,
      title: 'Test Movie',
      year: 2024,
      rating: 8.1,
      type: 'movie',
      genre: ['drama'],
      runtime: '120',
      poster: 'https://example.com/poster.jpg',
      hue: 0,
    })
  })
})

describe('mapDocToMovie — fallback названия name ?? alternativeName ?? enName', () => {
  it('name есть — используется name', () => {
    expect(
      mapDocToMovie(
        doc({ name: 'Primary', alternativeName: 'Alt', enName: 'En' }),
      ).title,
    ).toBe('Primary')
  })

  it('name отсутствует — используется alternativeName', () => {
    expect(
      mapDocToMovie(doc({ name: null, alternativeName: 'Alt', enName: 'En' }))
        .title,
    ).toBe('Alt')
  })

  it('name и alternativeName отсутствуют — используется enName', () => {
    expect(
      mapDocToMovie(doc({ name: null, alternativeName: null, enName: 'En' }))
        .title,
    ).toBe('En')
  })

  it('name, alternativeName и enName отсутствуют — пустая строка', () => {
    expect(
      mapDocToMovie(doc({ name: null, alternativeName: null, enName: null }))
        .title,
    ).toBe('')
  })
})

describe('mapDocToMovie — рейтинг rating.kp ?? rating.imdb ?? 0', () => {
  it('rating.kp равен 0 — используется 0, а не rating.imdb', () => {
    expect(mapDocToMovie(doc({ rating: { kp: 0, imdb: 6.5 } })).rating).toBe(0)
  })

  it('rating.kp отсутствует — используется rating.imdb', () => {
    expect(mapDocToMovie(doc({ rating: { kp: null, imdb: 6.5 } })).rating).toBe(
      6.5,
    )
  })

  it('rating целиком отсутствует — 0', () => {
    expect(mapDocToMovie(doc({ rating: null })).rating).toBe(0)
  })
})

describe('mapDocToMovie — отсутствие постера/года/остальных полей', () => {
  it('year отсутствует — undefined, а не текущий год', () => {
    expect(mapDocToMovie(doc({ year: null })).year).toBeUndefined()
  })

  it('poster.previewUrl отсутствует — пустая строка', () => {
    expect(mapDocToMovie(doc({ poster: { previewUrl: null } })).poster).toBe('')
  })

  it('poster целиком отсутствует — пустая строка', () => {
    expect(mapDocToMovie(doc({ poster: null })).poster).toBe('')
  })

  it('type отсутствует — по умолчанию "movie"', () => {
    expect(mapDocToMovie(doc({ type: null })).type).toBe('movie')
  })

  it('genres отсутствует — пустой массив', () => {
    expect(mapDocToMovie(doc({ genres: null })).genre).toEqual([])
  })

  it('movieLength отсутствует — runtime "0"', () => {
    expect(mapDocToMovie(doc({ movieLength: null })).runtime).toBe('0')
  })

  it('id отсутствует — 0', () => {
    expect(mapDocToMovie(doc({ id: null })).id).toBe(0)
  })
})
