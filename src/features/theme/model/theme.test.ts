import { context } from '@reatom/core'

import { readPersisted, seedPersisted } from '../../../test/persist'
import {
  initThemeSync,
  prefersDark,
  resolvedTheme,
  theme,
  toggleTheme,
} from './theme'

const KEY = 'kinoshka:theme'

// Подменяет глобальный стаб matchMedia (src/test/setup.ts): стартовое `matches` и ручной запуск
// 'change' — jsdom реальных media-событий не эмулирует.
const mockMatchMedia = (initial: boolean) => {
  // reatomMediaQuery на 'change' перечитывает mql.matches, а не event.matches.
  let matches = initial
  const listeners = new Set<(event: MediaQueryListEvent) => void>()

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches
    },
    media: query,
    addEventListener: (
      type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (type === 'change') listeners.add(listener)
    },
    removeEventListener: (
      type: string,
      listener: (event: MediaQueryListEvent) => void,
    ) => {
      if (type === 'change') listeners.delete(listener)
    },
  }))

  return {
    emitChange: (next: boolean) => {
      matches = next
      listeners.forEach(listener =>
        listener({ matches: next } as MediaQueryListEvent),
      )
    },
  }
}

// Подписка на атом нужна, чтобы media-слушатель реально повесился (computed без подписчиков
// не подключает зависимости).
const subscribed = <T>(read: () => T) => {
  const unsubscribe = resolvedTheme.subscribe(() => {})
  return { read, unsubscribe }
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme')
})

describe('resolvedTheme', () => {
  it.each([
    ['light', false, 'light'],
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['dark', true, 'dark'],
    ['system', false, 'light'],
    ['system', true, 'dark'],
  ] as const)('theme=%s, prefersDark=%s → %s', (value, dark, expected) => {
    mockMatchMedia(dark)
    theme.set(value)

    expect(resolvedTheme()).toBe(expected)
  })

  it('следует за сменой media query при theme=system', async () => {
    const { emitChange } = mockMatchMedia(false)
    const { unsubscribe } = subscribed(resolvedTheme)
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(resolvedTheme()).toBe('light')
    emitChange(true)
    expect(prefersDark()).toBe(true)
    expect(resolvedTheme()).toBe('dark')

    unsubscribe()
  })

  it('явная тема не зависит от media query', async () => {
    const { emitChange } = mockMatchMedia(false)
    theme.set('light')
    const { unsubscribe } = subscribed(resolvedTheme)
    await new Promise(resolve => setTimeout(resolve, 0))

    emitChange(true)

    expect(resolvedTheme()).toBe('light')
    unsubscribe()
  })
})

describe('toggleTheme', () => {
  it('dark → light и light → dark', () => {
    mockMatchMedia(false)
    theme.set('dark')
    toggleTheme()
    expect(theme()).toBe('light')

    toggleTheme()
    expect(theme()).toBe('dark')
  })

  it('из system переключает от resolvedTheme, а не от сырого значения', () => {
    mockMatchMedia(true)
    expect(theme()).toBe('system')

    toggleTheme()

    expect(theme()).toBe('light')
  })
})

describe('initThemeSync', () => {
  it('data-theme обновляется после смены темы', async () => {
    mockMatchMedia(false)
    initThemeSync()
    await vi.waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('light'),
    )

    theme.set('dark')

    await vi.waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )
  })

  it('data-theme следует за media query при system', async () => {
    const { emitChange } = mockMatchMedia(false)
    initThemeSync()
    await vi.waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('light'),
    )

    emitChange(true)

    await vi.waitFor(() =>
      expect(document.documentElement.dataset.theme).toBe('dark'),
    )
  })
})

describe('персист', () => {
  it('пишет конверт со строкой темы', () => {
    theme.set('dark')

    expect(readPersisted(KEY)).toBe('dark')
  })

  it('читает значение из seedPersisted при старте', () => {
    seedPersisted(KEY, 'dark')

    expect(context.start(() => theme())).toBe('dark')
  })

  it('мусор в хранилище даёт system', () => {
    seedPersisted(KEY, 'purple')

    expect(context.start(() => theme())).toBe('system')
  })

  it('кросс-таб: StorageEvent обновляет подключённый атом', async () => {
    mockMatchMedia(false)
    const unsubscribe = theme.subscribe(() => {})
    await new Promise(resolve => setTimeout(resolve, 0))

    seedPersisted(KEY, 'dark')
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: KEY,
        newValue: localStorage.getItem(KEY),
        storageArea: localStorage,
      }),
    )

    await vi.waitFor(() => expect(theme()).toBe('dark'))
    unsubscribe()
  })
})
