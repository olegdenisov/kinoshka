import { formatCurrency } from './formatCurrency'

describe('formatCurrency', () => {
  it('форматирует значение с разделителями тысяч и добавляет валюту', () => {
    expect(formatCurrency({ value: 4800000, currency: '$' })).toBe('4,800,000 $')
  })

  it('пустая currency — только число, без хвостового пробела', () => {
    expect(formatCurrency({ value: 1000, currency: '' })).toBe('1,000')
  })
})
