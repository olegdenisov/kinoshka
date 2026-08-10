import { formatCurrency } from './formatCurrency'

describe('formatCurrency', () => {
  it('форматирует значение с разделителями тысяч и добавляет валюту', () => {
    expect(formatCurrency({ value: 4800000, currency: '$' })).toBe('4,800,000 $')
  })

  it('пустая currency — только число, без хвостового пробела', () => {
    expect(formatCurrency({ value: 1000, currency: '' })).toBe('1,000')
  })

  it('value: 0 — форматирует как "0", а не как falsy-пропуск', () => {
    expect(formatCurrency({ value: 0, currency: '$' })).toBe('0 $')
  })
})
