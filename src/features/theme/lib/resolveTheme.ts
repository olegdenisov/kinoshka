import type { Theme } from '../model/theme'

export const resolveTheme = (
  theme: Theme,
  prefersDark: boolean,
): 'light' | 'dark' => {
  if (theme === 'system') {
    return prefersDark ? 'dark' : 'light'
  }

  return theme
}
