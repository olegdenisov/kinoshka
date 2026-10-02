import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'

import { resolveTheme } from '../lib/resolveTheme'
import { selectTheme, themeSet } from './themeSlice'
import type { ThemeRootState } from './themeSlice'
import type { Theme } from './themeStorage'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export type UseThemeResult = {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (next: Theme) => void
  toggleTheme: () => void
}

export const useTheme = (): UseThemeResult => {
  const theme = useSelector((state: ThemeRootState) => selectTheme(state))
  const dispatch = useDispatch()
  const setTheme = (next: Theme) => {
    dispatch(themeSet(next))
  }
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
