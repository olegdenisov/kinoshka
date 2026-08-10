import type { FilterState } from '../model/useFilterState'
import {
  EMPTY_FILTERS,
  filtersToSearchParams,
  getFilterFromSearchParams,
  stripFilterAndSortParams,
} from './searchParams'

describe('getFilterFromSearchParams', () => {
  it('пустой URL → пустой FilterState', () => {
    const result = getFilterFromSearchParams(new URLSearchParams())
    expect(result).toEqual(EMPTY_FILTERS)
  })

  it('читает все ключи FilterState из URL', () => {
    const sp = new URLSearchParams(
      'type=movie&genres=Drama,Action&yearFrom=2020&yearTo=2025&rating=7',
    )
    const result = getFilterFromSearchParams(sp)

    expect(result).toEqual<FilterState>({
      type: 'movie',
      genres: ['Drama', 'Action'],
      yearFrom: 2020,
      yearTo: 2025,
      rating: 7,
    })
  })

  it('csv-жанры парсятся в массив, лишние запятые/пустые сегменты отбрасываются', () => {
    const sp = new URLSearchParams('genres=Drama,,Action,')
    const result = getFilterFromSearchParams(sp)
    expect(result.genres).toEqual(['Drama', 'Action'])
  })

  it('?rating=abc (не число) → весь FilterState откатывается на дефолт', () => {
    const sp = new URLSearchParams('rating=abc&type=movie')
    const result = getFilterFromSearchParams(sp)
    expect(result).toEqual(EMPTY_FILTERS)
  })

  it('rating вне диапазона 0-10 → дефолт', () => {
    const sp = new URLSearchParams('rating=42')
    const result = getFilterFromSearchParams(sp)
    expect(result).toEqual(EMPTY_FILTERS)
  })

  it('нечисловой yearFrom → дефолт (не бросает)', () => {
    const sp = new URLSearchParams('yearFrom=not-a-year')
    expect(() => getFilterFromSearchParams(sp)).not.toThrow()
    expect(getFilterFromSearchParams(sp)).toEqual(EMPTY_FILTERS)
  })

  it('только часть ключей задана — остальные дефолтные', () => {
    const sp = new URLSearchParams('rating=8')
    const result = getFilterFromSearchParams(sp)
    expect(result).toEqual({ ...EMPTY_FILTERS, rating: 8 })
  })
})

describe('filtersToSearchParams', () => {
  it('пустой FilterState → пустые URLSearchParams', () => {
    const params = filtersToSearchParams(EMPTY_FILTERS)
    expect(params.toString()).toBe('')
  })

  it('заполненный FilterState → соответствующие ключи в URL', () => {
    const filters: FilterState = {
      type: 'movie',
      genres: ['Drama', 'Action'],
      yearFrom: 2020,
      yearTo: 2025,
      rating: 7,
    }
    const params = filtersToSearchParams(filters)

    expect(params.get('type')).toBe('movie')
    expect(params.get('genres')).toBe('Drama,Action')
    expect(params.get('yearFrom')).toBe('2020')
    expect(params.get('yearTo')).toBe('2025')
    expect(params.get('rating')).toBe('7')
  })

  it('null/пустые поля не пишутся в URL', () => {
    const filters: FilterState = {
      type: null,
      genres: [],
      yearFrom: null,
      yearTo: 2025,
      rating: null,
    }
    const params = filtersToSearchParams(filters)

    expect(params.has('type')).toBe(false)
    expect(params.has('genres')).toBe(false)
    expect(params.has('yearFrom')).toBe(false)
    expect(params.get('yearTo')).toBe('2025')
    expect(params.has('rating')).toBe(false)
  })

  it('round-trip: getFilterFromSearchParams(filtersToSearchParams(f)) === f', () => {
    const filters: FilterState = {
      type: 'anime',
      genres: ['Fantasy'],
      yearFrom: 2018,
      yearTo: 2022,
      rating: 5,
    }
    const roundTripped = getFilterFromSearchParams(filtersToSearchParams(filters))
    expect(roundTripped).toEqual(filters)
  })
})

describe('stripFilterAndSortParams', () => {
  it('удаляет все 6 ключей (5 фильтров + sort), не трогая q/page', () => {
    const sp = new URLSearchParams(
      'q=inception&page=3&type=movie&genres=Drama,Action&yearFrom=2020&yearTo=2025&rating=7&sort=Newest',
    )
    const result = stripFilterAndSortParams(sp)

    expect(result.has('type')).toBe(false)
    expect(result.has('genres')).toBe(false)
    expect(result.has('yearFrom')).toBe(false)
    expect(result.has('yearTo')).toBe(false)
    expect(result.has('rating')).toBe(false)
    expect(result.has('sort')).toBe(false)
    expect(result.get('q')).toBe('inception')
    expect(result.get('page')).toBe('3')
  })

  it('no-op на пустых params', () => {
    const result = stripFilterAndSortParams(new URLSearchParams())
    expect(result.toString()).toBe('')
  })

  it('не мутирует переданный params', () => {
    const sp = new URLSearchParams('genres=Drama&sort=Newest')
    stripFilterAndSortParams(sp)
    expect(sp.has('genres')).toBe(true)
    expect(sp.has('sort')).toBe(true)
  })
})
