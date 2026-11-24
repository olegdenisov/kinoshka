import {
  action,
  computed,
  effect,
  reatomEnum,
  reatomMediaQuery,
  withLocalStorage,
} from '@reatom/core'
import { persistOptions } from '@shared/lib'
import { z } from 'zod'

import { resolveTheme } from '../lib/resolveTheme'

const themeSchema = z.enum(['light', 'dark', 'system'])

export type Theme = z.infer<typeof themeSchema>

export const theme = reatomEnum(['light', 'dark', 'system'], {
  name: 'theme',
  initState: 'system',
}).extend(
  withLocalStorage(
    persistOptions<Theme>({
      key: 'kinoshka:theme',
      schema: themeSchema,
      fallback: 'system',
    }),
  ),
)

export const prefersDark = reatomMediaQuery(
  '(prefers-color-scheme: dark)',
  'theme.prefersDark',
)

export const resolvedTheme = computed(
  () => resolveTheme(theme(), prefersDark()),
  'theme.resolved',
)

// Переключаем от resolvedTheme, а не от сырого значения: из 'system' результат должен быть
// противоположен тому, что пользователь видит сейчас.
export const toggleTheme = action(() => {
  theme.set(resolvedTheme() === 'dark' ? 'light' : 'dark')
}, 'theme.toggle')

// effect создаётся в action, а не на уровне модуля: модульный effect не переживает
// context.reset() (тесты) и стартовал бы до вызова из reatom-setup.
export const initThemeSync = action(() => {
  effect(() => {
    document.documentElement.setAttribute('data-theme', resolvedTheme())
  }, 'theme.syncDataTheme')
}, 'theme.init')
