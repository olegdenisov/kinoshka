import { resolveTheme } from './resolveTheme'

describe('resolveTheme', () => {
  it('resolves "light" to "light" when prefersDark is true', () => {
    expect(resolveTheme('light', true)).toBe('light')
  })

  it('resolves "light" to "light" when prefersDark is false', () => {
    expect(resolveTheme('light', false)).toBe('light')
  })

  it('resolves "dark" to "dark" when prefersDark is true', () => {
    expect(resolveTheme('dark', true)).toBe('dark')
  })

  it('resolves "dark" to "dark" when prefersDark is false', () => {
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('resolves "system" to "dark" when prefersDark is true', () => {
    expect(resolveTheme('system', true)).toBe('dark')
  })

  it('resolves "system" to "light" when prefersDark is false', () => {
    expect(resolveTheme('system', false)).toBe('light')
  })
})
