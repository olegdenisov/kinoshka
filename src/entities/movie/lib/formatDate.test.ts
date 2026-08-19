import { formatDate } from './formatDate'

describe('formatDate', () => {
  it('en-US — "Month D, YYYY"', () => {
    expect(formatDate('2024-03-14', 'en-US')).toBe('March 14, 2024')
  })

  it('ru-RU — «D месяца YYYY г.» (учитывает язык)', () => {
    expect(formatDate('2024-03-14', 'ru-RU')).toBe('14 марта 2024 г.')
  })

  it('невалидная дата — возвращает исходную строку как есть', () => {
    expect(formatDate('not-a-date', 'en-US')).toBe('not-a-date')
  })

  it('без явной locale — использует navigator.language', () => {
    expect(formatDate('2024-03-14')).toBe('March 14, 2024')
  })
})
