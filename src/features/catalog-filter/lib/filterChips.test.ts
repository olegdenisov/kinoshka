import { describe, expect, it } from 'vitest'

import type { FilterState } from '../model/types'
import { getFilterChips, removeChipFromFilters } from './filterChips'
import { EMPTY_FILTERS } from './searchParams'

const FULL: FilterState = {
  type: 'movie',
  genres: ['драма', 'боевик'],
  yearFrom: 2020,
  yearTo: 2025,
  rating: 7,
  countries: ['США', 'Россия'],
  duration: 'short',
  platforms: ['Okko', 'Иви'],
  list: 'top250',
}

describe('getFilterChips', () => {
  it('пустые фильтры не дают чипов', () => {
    expect(getFilterChips(EMPTY_FILTERS)).toEqual([])
  })

  it('строит чипы всех видов в стабильном порядке', () => {
    expect(getFilterChips(FULL)).toEqual([
      { id: 'type', label: 'Movies' },
      { id: 'genre:драма', label: 'Drama' },
      { id: 'genre:боевик', label: 'Action' },
      { id: 'year', label: '2020–2025' },
      { id: 'rating', label: 'Rating 7+' },
      { id: 'country:США', label: 'USA' },
      { id: 'country:Россия', label: 'Russia' },
      { id: 'duration', label: 'Under 90 min' },
      { id: 'platform:Okko', label: 'Okko' },
      { id: 'platform:Иви', label: 'Ivi' },
      { id: 'list', label: 'Top 250' },
    ])
  })

  it('yearLabel: только yearFrom → "2020+", только yearTo → "–2025"', () => {
    const from = getFilterChips({ ...EMPTY_FILTERS, yearFrom: 2020 })
    expect(from).toEqual([{ id: 'year', label: '2020+' }])
    const to = getFilterChips({ ...EMPTY_FILTERS, yearTo: 2025 })
    expect(to).toEqual([{ id: 'year', label: '–2025' }])
  })

  it('неизвестный type показывается как есть', () => {
    expect(getFilterChips({ ...EMPTY_FILTERS, type: 'cartoon' })).toEqual([
      { id: 'type', label: 'cartoon' },
    ])
  })
})

describe('removeChipFromFilters', () => {
  it('снимает каждый чип, остальные фильтры не трогает', () => {
    let filters = FULL
    for (const { id } of getFilterChips(FULL)) {
      const next = removeChipFromFilters(filters, id)
      expect(getFilterChips(next).map(c => c.id)).not.toContain(id)
      expect(getFilterChips(next)).toHaveLength(
        getFilterChips(filters).length - 1,
      )
      filters = next
    }
    expect(filters).toEqual(EMPTY_FILTERS)
  })

  it('genre/country/platform снимают только значение из id', () => {
    expect(removeChipFromFilters(FULL, 'genre:драма').genres).toEqual([
      'боевик',
    ])
    expect(removeChipFromFilters(FULL, 'country:США').countries).toEqual([
      'Россия',
    ])
    expect(removeChipFromFilters(FULL, 'platform:Okko').platforms).toEqual([
      'Иви',
    ])
  })

  it('year обнуляет оба края', () => {
    const next = removeChipFromFilters(FULL, 'year')
    expect([next.yearFrom, next.yearTo]).toEqual([null, null])
  })

  it('неизвестный id возвращает те же фильтры', () => {
    expect(removeChipFromFilters(FULL, 'nope:1')).toBe(FULL)
  })
})
