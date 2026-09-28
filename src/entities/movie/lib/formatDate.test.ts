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

  // Kinopoisk присылает календарные даты (день рождения/смерти, премьера)
  // как UTC-полночь, а не момент времени — без timeZone: 'UTC' в форматтере
  // Intl показал бы предыдущий день в часовых поясах западнее UTC. Node
  // подхватывает process.env.TZ для каждого нового Intl.DateTimeFormat, so
  // можно временно переключить пояс процесса прямо в тесте (проверено:
  // без timeZone: 'UTC' этот тест падает и возвращает 'September 1, 1964').
  it('UTC-полночь — день не съезжает в часовом поясе западнее UTC', () => {
    const originalTz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'

    try {
      expect(formatDate('1964-09-02T00:00:00.000Z', 'en-US')).toBe(
        'September 2, 1964',
      )
    } finally {
      process.env.TZ = originalTz
    }
  })
})
