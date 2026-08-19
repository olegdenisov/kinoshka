import { IconButton, SunIcon, MoonIcon } from '@shared/ui'

import { useTheme } from '../../model/useTheme'

export const ThemeToggle = () => {
  const { resolvedTheme, toggleTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <IconButton
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  )
}
