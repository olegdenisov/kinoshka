import type { FilterState } from '../model/useFilterState'
import { filtersToParams } from './filtersToParams'

const EMPTY_FILTERS: FilterState = {
  type: null,
  genres: [],
  yearFrom: null,
  yearTo: null,
  rating: null,
}

describe('filtersToParams', () => {
  it('пустой фильтр без sort → { limit: 10 }', () => {
    expect(filtersToParams(EMPTY_FILTERS)).toEqual({ limit: 10 })
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

  it('genres мапятся EN→RU в "genres.name"', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, genres: ['Drama', 'Action'] })
    expect(params['genres.name']).toEqual(['драма', 'боевик'])
  })

  it('неизвестный жанр (Slice of Life) отбрасывается, известные остаются', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, genres: ['Drama', 'Slice of Life'] })
    expect(params['genres.name']).toEqual(['драма'])
  })

  it('все жанры неизвестны → "genres.name" не пишем', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, genres: ['Slice of Life'] })
    expect(params['genres.name']).toBeUndefined()
  })

  it('yearFrom/yearTo → year: ["from-to"]', () => {
    const params = filtersToParams({ ...EMPTY_FILTERS, yearFrom: 2020, yearTo: 2025 })
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
      type: 'movie',
      genres: ['Drama'],
      yearFrom: 2020,
      yearTo: 2024,
      rating: 6,
    }
    const params = filtersToParams(filters, 'Highest rated')

    expect(params).toEqual({
      limit: 10,
      type: ['movie'],
      'genres.name': ['драма'],
      year: ['2020-2024'],
      'rating.kp': ['6-10'],
      sortField: ['rating.kp'],
      sortType: ['-1'],
    })
  })
})
