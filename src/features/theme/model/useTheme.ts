import { useStorageSlot } from '@shared/lib'
import { useEffect, useState } from 'react'

import { resolveTheme } from '../lib/resolveTheme'
import { themeSlot } from './themeStorage'
import type { Theme } from './themeStorage'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export type UseThemeResult = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

export const useTheme = (): UseThemeResult => {
  const [theme, setTheme] = useStorageSlot(themeSlot)
  const [prefersDark, setPrefersDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersDark(event.matches)
    }

    mediaQuery.addEventListener('change', handleChange)

    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const resolvedTheme = resolveTheme(theme, prefersDark)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme)
  }, [resolvedTheme])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return { theme, resolvedTheme, setTheme, toggleTheme }
}
