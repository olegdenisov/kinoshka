import {
  getCountryLabel,
  getDurationLabel,
  getListLabel,
  getPlatformLabel,
} from './filterOptions'

describe('filterOptions', () => {
  it('getDurationLabel: известные пресеты → подписи', () => {
    expect(getDurationLabel('short')).toBe('Under 90 min')
    expect(getDurationLabel('medium')).toBe('90–120 min')
    expect(getDurationLabel('long')).toBe('Over 2 hours')
  })

  it('getPlatformLabel: русские имена API → латиница, латинские остаются', () => {
    expect(getPlatformLabel('Иви')).toBe('Ivi')
    expect(getPlatformLabel('КИОН')).toBe('Kion')
    expect(getPlatformLabel('PREMIER')).toBe('Premier')
    expect(getPlatformLabel('Kinopoisk HD')).toBe('Kinopoisk HD')
  })

  it('getListLabel: slug → подпись', () => {
    expect(getListLabel('top250')).toBe('Top 250')
    expect(getListLabel('100_greatest_movies_XXI')).toBe(
      'Best of the 21st century',
    )
  })

  it('getCountryLabel: шорт-лист — по-английски', () => {
    expect(getCountryLabel('США')).toBe('USA')
    expect(getCountryLabel('Корея Южная')).toBe('South Korea')
  })

  it.each([
    ['getDurationLabel', getDurationLabel, 'foo'],
    ['getPlatformLabel', getPlatformLabel, 'Netflix'],
    ['getListLabel', getListLabel, 'unknown-slug'],
    ['getCountryLabel', getCountryLabel, 'Бразилия'],
  ])('%s: неизвестное значение → сырое значение', (_, getLabel, value) => {
    expect(getLabel(value)).toBe(value)
  })
})
