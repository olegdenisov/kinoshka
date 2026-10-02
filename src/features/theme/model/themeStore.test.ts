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
    void useThemeStore.persist.rehydrate()

    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('невалидное сохранённое значение → system', () => {
    seedStorage('kinoshka:theme', JSON.stringify('sepia'))
    void useThemeStore.persist.rehydrate()

    expect(useThemeStore.getState().theme).toBe('system')
  })
})
