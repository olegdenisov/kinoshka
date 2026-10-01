import type { FilterState } from '../model/useFilterState'
import { LIST_OPTIONS, PLATFORM_OPTIONS } from './filterOptions'
import { filtersToParams } from './filtersToParams'
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  getFilterFromSearchParams,
} from './searchParams'

describe('filtersToParams', () => {
  it('пустой фильтр без sort → { limit: 12 }', () => {
    expect(filtersToParams(EMPTY_FILTERS)).toEqual({ limit: 12 })
  })

  it('type "movie" → type: ["movie"]', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, type: 'movie' })
    expect(params.type).toEqual(['movie'])
  })

  it('type "series" → type: ["tv-series"] (v1.5 не знает "series")', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, type: 'series' })
    expect(params.type).toEqual(['tv-series'])
  })

  it('type "anime" → type: ["anime"]', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, type: 'anime' })
    expect(params.type).toEqual(['anime'])
  })

  it('неизвестный type не попадает в параметры', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, type: 'not-a-type' })
    expect(params.type).toBeUndefined()
  })

  it('genres (RU-названия справочника) проходят в "genres.name" без изменений', () => {
    const params = filtersToParams({
      ...EMPTY_FILTERS,
      genres: ['драма', 'боевик'],
    })
    expect(params['genres.name']).toEqual(['драма', 'боевик'])
  })

  it('пустой список жанров → "genres.name" не пишем', () => {
    const params = filtersToParams({
      ...EMPTY_FILTERS,
      genres: [],
    })
    expect(params['genres.name']).toBeUndefined()
  })

  it('yearFrom/yearTo → year: ["from-to"]', () => {
    const params = filtersToParams({
      ...EMPTY_FILTERS,
      yearFrom: 2020,
      yearTo: 2025,
    })
    expect(params.year).toEqual(['2020-2025'])
  })

  it('edge: только yearFrom (без yearTo и rating) — открытый диапазон до YEAR_RANGE_MAX (2050), не точный год', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, yearFrom: 2020 })
    expect(params.year).toEqual(['2020-2050'])
    expect(params['rating.kp']).toBeUndefined()
  })

  it('edge: только yearTo — открытый диапазон от YEAR_RANGE_MIN (1874), не точный год', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, yearTo: 2025 })
    expect(params.year).toEqual(['1874-2025'])
  })

  it('rating → "rating.kp": ["n-10"]', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, rating: 7 })
    expect(params['rating.kp']).toEqual(['7-10'])
  })

  it.each([
    ['Popular', 'votes.kp', '-1'],
    ['Newest', 'year', '-1'],
    ['Highest rated', 'rating.kp', '-1'],
    ['Most watched', 'votes.imdb', '-1'],
    ['A to Z', 'name', '1'],
  ])('sort "%s" → sortField: ["%s"], sortType: ["%s"]', (sort, field, type) => {
    const params = filtersToParams(EMPTY_FILTERS, sort)
    expect(params.sortField).toEqual([field])
    expect(params.sortType).toEqual([type])
  })

  it('неизвестный sort игнорируется (sortField/sortType не пишем)', () => {
    const params = filtersToParams(EMPTY_FILTERS, 'Not A Sort')
    expect(params.sortField).toBeUndefined()
    expect(params.sortType).toBeUndefined()
  })

  it('комбинация всех фильтров + sort собирается в один объект', () => {
    const filters: FilterState = {
      ...EMPTY_FILTERS,
      type: 'movie',
      genres: ['драма'],
      yearFrom: 2020,
      yearTo: 2024,
      rating: 6,
      countries: ['США'],
      duration: 'medium',
      platforms: ['Okko'],
      list: 'top250',
    }
    const params = filtersToParams(filters, 'Highest rated')

    expect(params).toEqual({
      limit: 12,
      type: ['movie'],
      'genres.name': ['драма'],
      year: ['2020-2024'],
      'rating.kp': ['6-10'],
      'countries.name': ['США'],
      movieLength: ['90-120'],
      'watchability.items.name': ['Okko'],
      lists: ['top250'],
      sortField: ['rating.kp'],
      sortType: ['-1'],
    })
  })

  it.each([
    ['short', '1-89'],
    ['medium', '90-120'],
    ['long', '121-999'],
  ] as const)('duration "%s" → movieLength: ["%s"]', (duration, range) => {
    const params = filtersToParams({ ...EMPTY_FILTERS, duration })
    expect(params.movieLength).toEqual([range])
  })

  it('countries → "countries.name" как есть', () => {
    const params = filtersToParams({
      ...EMPTY_FILTERS,
      countries: ['США', 'Франция'],
    })
    expect(params['countries.name']).toEqual(['США', 'Франция'])
  })

  it('platforms → "watchability.items.name" как есть', () => {
    const params = filtersToParams({
      ...EMPTY_FILTERS,
      platforms: ['Иви', 'Okko'],
    })
    expect(params['watchability.items.name']).toEqual(['Иви', 'Okko'])
  })

  it('list → lists: [slug]', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, list: 'top250' })
    expect(params.lists).toEqual(['top250'])
  })

  it('пустые новые поля не попадают в параметры', () => {
    const params = filtersToParams(EMPTY_FILTERS)
    expect(params['countries.name']).toBeUndefined()
    expect(params.movieLength).toBeUndefined()
    expect(params['watchability.items.name']).toBeUndefined()
    expect(params.lists).toBeUndefined()
  })
})

describe('опции платформ и подборок', () => {
  it.each(PLATFORM_OPTIONS.map(o => o.value))(
    'платформа %s: URL-раунд-трип и параметр API',
    value => {
      const filters = { ...EMPTY_FILTERS, platforms: [value] }
      const restored = getFilterFromSearchParams(filtersToSearchParams(filters))
      expect(restored.platforms).toEqual([value])
      expect(filtersToParams(restored)['watchability.items.name']).toEqual([
        value,
      ])
    },
  )

  it.each(LIST_OPTIONS.map(o => o.value))(
    'подборка %s: URL-раунд-трип и параметр API',
    value => {
      const filters = { ...EMPTY_FILTERS, list: value }
      const restored = getFilterFromSearchParams(filtersToSearchParams(filters))
      expect(restored.list).toBe(value)
      expect(filtersToParams(restored).lists).toEqual([value])
    },
  )
})
