import { hasVisibleChar, isInvisibleCodePoint } from './visibleChars'

describe('hasVisibleChar', () => {
  it('true для строки с видимыми символами', () => {
    expect(hasVisibleChar('Ada')).toBe(true)
    expect(hasVisibleChar('​Ada')).toBe(true)
  })

  it('false для пустой строки и строки из одних невидимых символов', () => {
    expect(hasVisibleChar('')).toBe(false)
    expect(hasVisibleChar('​⠀ ‮')).toBe(false)
  })
})

describe('isInvisibleCodePoint', () => {
  it('различает невидимые и видимые code points', () => {
    expect(isInvisibleCodePoint('​')).toBe(true)
    expect(isInvisibleCodePoint('⠀')).toBe(true)
    expect(isInvisibleCodePoint('A')).toBe(false)
    expect(isInvisibleCodePoint('😀')).toBe(false)
  })
})
