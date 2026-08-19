import { themeSlot } from './themeStorage'

beforeEach(() => localStorage.clear())

describe('themeSlot', () => {
  it('валидное значение читается корректно', () => {
    themeSlot.set('light')

    expect(themeSlot.get()).toBe('light')
  })

  it('валидное значение "dark" читается корректно', () => {
    themeSlot.set('dark')

    expect(themeSlot.get()).toBe('dark')
  })

  it('невалидное значение (не входящее в enum) → fallback "system"', () => {
    localStorage.setItem('kinoshka:theme', JSON.stringify('sepia'))

    expect(themeSlot.get()).toBe('system')
  })

  it('битый JSON → fallback "system"', () => {
    localStorage.setItem('kinoshka:theme', '{not-json')

    expect(themeSlot.get()).toBe('system')
  })

  it('отсутствие ключа → fallback "system"', () => {
    expect(themeSlot.get()).toBe('system')
  })
})
