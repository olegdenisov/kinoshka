import { seedStorage } from '../../../test/seedStorage'
import { useThemeStore } from './themeStore'

describe('useThemeStore', () => {
  it.each(['light', 'dark', 'system'] as const)(
    'setTheme(%s) пишет голый JSON в localStorage',
    theme => {
      useThemeStore.getState().setTheme(theme)

      expect(useThemeStore.getState().theme).toBe(theme)
      expect(localStorage.getItem('kinoshka:theme')).toBe(JSON.stringify(theme))
    },
  )

  it('rehydrate подхватывает сохранённое значение', () => {
    seedStorage('kinoshka:theme', JSON.stringify('dark'))

    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('невалидное сохранённое значение → system', () => {
    seedStorage('kinoshka:theme', JSON.stringify('sepia'))

    expect(useThemeStore.getState().theme).toBe('system')
  })

  it('неудачная запись откатывает тему к сохранённой', () => {
    useThemeStore.getState().setTheme('dark')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(() => useThemeStore.getState().setTheme('light')).not.toThrow()
    expect(useThemeStore.getState().theme).toBe('dark')
    expect(localStorage.getItem('kinoshka:theme')).toBe(JSON.stringify('dark'))
    vi.restoreAllMocks()
  })
})
