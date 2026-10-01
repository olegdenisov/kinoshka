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
      ...EMPTY_FILTERS,
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
      ...EMPTY_FILTERS,
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
      ...EMPTY_FILTERS,
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
      ...EMPTY_FILTERS,
      type: 'anime',
      genres: ['Fantasy'],
      yearFrom: 2018,
      yearTo: 2022,
      rating: 5,
    }
    const roundTripped = getFilterFromSearchParams(
      filtersToSearchParams(filters),
    )
    expect(roundTripped).toEqual(filters)
  })
})

describe('новые поля: countries, duration, platforms, list', () => {
  const roundTrip = (filters: FilterState) =>
    getFilterFromSearchParams(filtersToSearchParams(filters))

  it.each<[string, Partial<FilterState>]>([
    ['countries', { countries: ['США', 'Корея Южная'] }],
    ['duration', { duration: 'medium' }],
    ['platforms', { platforms: ['Иви', 'Kinopoisk HD'] }],
    ['list', { list: '100_greatest_movies_XXI' }],
  ])('round-trip %s', (_, patch) => {
    const filters: FilterState = { ...EMPTY_FILTERS, ...patch }
    expect(roundTrip(filters)).toEqual(filters)
  })

  it('round-trip всех полей сразу', () => {
    const filters: FilterState = {
      type: 'movie',
      genres: ['драма'],
      yearFrom: 2000,
      yearTo: 2020,
      rating: 7,
      countries: ['Франция', 'Италия'],
      duration: 'long',
      platforms: ['Okko', 'КИОН'],
      list: 'top250',
    }
    expect(roundTrip(filters)).toEqual(filters)
  })

  it('пишет новые поля в URL: списки через запятую', () => {
    const params = filtersToSearchParams({
      ...EMPTY_FILTERS,
      countries: ['США', 'Франция'],
      duration: 'short',
      platforms: ['Иви', 'Okko'],
      list: 'top500',
    })
    expect(params.get('countries')).toBe('США,Франция')
    expect(params.get('duration')).toBe('short')
    expect(params.get('platforms')).toBe('Иви,Okko')
    expect(params.get('list')).toBe('top500')
  })

  it('пустые/null новые поля не пишутся в URL', () => {
    const params = filtersToSearchParams(EMPTY_FILTERS)
    expect(params.has('countries')).toBe(false)
    expect(params.has('duration')).toBe(false)
    expect(params.has('platforms')).toBe(false)
    expect(params.has('list')).toBe(false)
  })

  it('?duration=foo (неизвестный пресет) → весь FilterState откатывается на дефолт', () => {
    const sp = new URLSearchParams('duration=foo&type=movie&countries=США')
    expect(getFilterFromSearchParams(sp)).toEqual(EMPTY_FILTERS)
  })

  it('пустые значения в URL (?countries=&platforms=&list=&duration=) → пустые массивы/null', () => {
    const sp = new URLSearchParams('countries=&platforms=&list=&duration=')
    expect(getFilterFromSearchParams(sp)).toEqual(EMPTY_FILTERS)
  })

  it('лишние запятые в списках отбрасываются', () => {
    const sp = new URLSearchParams('countries=США,,Франция,&platforms=,Okko')
    const result = getFilterFromSearchParams(sp)
    expect(result.countries).toEqual(['США', 'Франция'])
    expect(result.platforms).toEqual(['Okko'])
  })

  it('неизвестные платформа/подборка проходят как есть (не валидируются по списку опций)', () => {
    // Осознанно: в отличие от duration, свободные строки не роняют весь FilterState —
    // неизвестное значение просто даёт пустую выдачу.
    const sp = new URLSearchParams('list=garbage&platforms=foo')
    const result = getFilterFromSearchParams(sp)
    expect(result.list).toBe('garbage')
    expect(result.platforms).toEqual(['foo'])
  })

  it('percent-encoded кириллица читается и переживает round-trip', () => {
    const sp = new URLSearchParams(
      'countries=%D0%A1%D0%A8%D0%90,%D0%9A%D0%BE%D1%80%D0%B5%D1%8F%20%D0%AE%D0%B6%D0%BD%D0%B0%D1%8F',
    )
    const result = getFilterFromSearchParams(sp)
    expect(result.countries).toEqual(['США', 'Корея Южная'])
    expect(
      getFilterFromSearchParams(
        new URLSearchParams(filtersToSearchParams(result).toString()),
      ),
    ).toEqual(result)
  })
})

describe('stripFilterAndSortParams', () => {
  it('удаляет все ключи фильтров и sort, не трогая q/page', () => {
    const sp = new URLSearchParams(
      'q=inception&page=3&type=movie&genres=Drama,Action&yearFrom=2020&yearTo=2025&rating=7&countries=США&duration=long&platforms=Okko&list=top250&sort=Newest',
    )
    const result = stripFilterAndSortParams(sp)

    expect(result.has('countries')).toBe(false)
    expect(result.has('duration')).toBe(false)
    expect(result.has('platforms')).toBe(false)
    expect(result.has('list')).toBe(false)

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
