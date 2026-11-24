import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { IconButton, SunIcon, MoonIcon } from '@shared/ui'

import { resolvedTheme, toggleTheme } from '../../model/theme'

export const ThemeToggle = reatomComponent(() => {
  const isDark = resolvedTheme() === 'dark'

  return (
    <IconButton
      onClick={wrap(toggleTheme)}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </IconButton>
  )
}, 'ThemeToggle')
