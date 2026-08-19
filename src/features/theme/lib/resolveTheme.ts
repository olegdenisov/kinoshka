import type { Theme } from '../model/themeStorage'

export const resolveTheme = (
  theme: Theme,
  prefersDark: boolean,
): 'light' | 'dark' => {
  if (theme === 'system') {
    return prefersDark ? 'dark' : 'light'
  }

  return theme
}
