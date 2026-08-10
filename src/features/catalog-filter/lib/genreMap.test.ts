import { ALL_GENRES } from '@entities/movie'
import { toApiGenre } from './genreMap'

// Локальная копия ALL_GENRES из SearchSidebar.tsx (widgets-слой) —
// features не может импортировать widgets (FSD: импорты только вниз),
// поэтому список продублирован здесь для покрытия обоих источников.
const SEARCH_SIDEBAR_GENRES = [
  'Action',
  'Drama',
  'Sci-Fi',
  'Thriller',
  'Romance',
  'Horror',
  'Mystery',
  'Documentary',
  'Historical',
  'Adventure',
  'Family',
  'Slice of Life',
  'Fantasy',
]

const UNKNOWN_GENRES = ['Slice of Life']

describe('genreMap / toApiGenre', () => {
  it.each(ALL_GENRES.filter(g => !UNKNOWN_GENRES.includes(g)))(
    'мапит жанр каталога "%s" в непустую русскую строку',
    genre => {
      const result = toApiGenre(genre)
      expect(typeof result).toBe('string')
      expect(result).not.toBe('')
    },
  )

  it.each(SEARCH_SIDEBAR_GENRES.filter(g => !UNKNOWN_GENRES.includes(g)))(
    'мапит жанр сайдбара "%s" в непустую русскую строку',
    genre => {
      const result = toApiGenre(genre)
      expect(typeof result).toBe('string')
      expect(result).not.toBe('')
    },
  )

  it.each(UNKNOWN_GENRES)('неизвестный жанр "%s" → undefined (skip), не бросает', genre => {
    expect(() => toApiGenre(genre)).not.toThrow()
    expect(toApiGenre(genre)).toBeUndefined()
  })

  it('жанр, отсутствующий в обоих UI-списках, тоже → undefined', () => {
    expect(toApiGenre('Not A Real Genre')).toBeUndefined()
  })

  it('каждый EN-жанр из обоих UI-источников присутствует в GENRE_MAP или явно помечен как unknown', () => {
    const allUiGenres = new Set([...ALL_GENRES, ...SEARCH_SIDEBAR_GENRES])
    allUiGenres.forEach(genre => {
      const mapped = toApiGenre(genre)
      if (UNKNOWN_GENRES.includes(genre)) {
        expect(mapped).toBeUndefined()
      } else {
        expect(mapped).toBeDefined()
      }
    })
  })
})
