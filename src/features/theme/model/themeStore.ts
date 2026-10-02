import { createPersistedStore } from '@shared/lib'

import { themeSlot } from './themeStorage'
import type { Theme } from './themeStorage'

type ThemeState = {
  theme: Theme
  setTheme: (next: Theme) => void
}

// Формат хранилища — голый JSON ("dark"), его читает инлайн-скрипт в index.html до гидрации.
export const useThemeStore = createPersistedStore<ThemeState, Theme>({
  name: 'theme',
  slot: themeSlot,
  select: state => state.theme,
  merge: (theme, state) => ({ ...state, theme }),
  creator: commit => ({
    theme: themeSlot.get(),
    setTheme: next => {
      commit({ theme: next })
    },
  }),
})
