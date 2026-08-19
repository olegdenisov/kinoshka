import '@testing-library/jest-dom/vitest'
import {
  resetAllCachedFetchers,
  resetGenreDictionaryState,
} from '@entities/movie'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'

// window.matchMedia — jsdom does not implement it at all (docs/plans/20260819-theme-toggle.md,
// Task 4). useTheme() calls `window.matchMedia('(prefers-color-scheme: dark)')` unconditionally,
// so without this stub every test that mounts a component using useTheme()/ThemeToggle would
// throw "window.matchMedia is not a function". Listeners are stored per query string (not
// no-op'd) so a test can retrieve `addEventListener.mock.calls` / reassign `window.matchMedia`
// itself and invoke the stored 'change' listener directly to simulate a system theme change —
// see useTheme.test.tsx for the per-test override pattern (this global stub only guarantees
// `matches: false` and a working subscribe/unsubscribe by default).
const mediaQueryListeners = new Map<
  string,
  Set<(event: MediaQueryListEvent) => void>
>()

window.matchMedia = vi.fn().mockImplementation((query: string) => {
  const listeners =
    mediaQueryListeners.get(query) ??
    new Set<(event: MediaQueryListEvent) => void>()
  mediaQueryListeners.set(query, listeners)

  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.add(listener)
      },
    ),
    removeEventListener: vi.fn(
      (type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') listeners.delete(listener)
      },
    ),
    dispatchEvent: vi.fn(),
  } as unknown as MediaQueryList
})

// Дефолтный MSW-хендлер для справочника жанров (Task 3, docs/plans/20260815-dynamic-genre-
// dictionary.md) — без него любой тест, рендерящий SearchDesktop/SearchSidebar/SearchMobile
// (эти компоненты вызывают useGenreDictionary → фоновый fetch), падает на
// `onUnhandledRequest: 'error'`. Отдельные тесты переопределяют этот хендлер через
// `server.use(...)`, если им нужен конкретный набор жанров или сценарий ошибки.
const DEFAULT_GENRE_DICTIONARY_ITEMS = [
  { id: 1, name: 'боевик', slug: null, enName: null },
  { id: 2, name: 'драма', slug: null, enName: null },
  { id: 3, name: 'триллер', slug: null, enName: null },
]

export const server = setupServer(
  http.get('*/v1.5/dictionary/genres', () =>
    HttpResponse.json({
      type: 'genres',
      total: DEFAULT_GENRE_DICTIONARY_ITEMS.length,
      items: DEFAULT_GENRE_DICTIONARY_ITEMS,
    }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
// createCachedFetcher's in-memory cache is module-level (survives across tests within the
// same file and across files) — without this, tests hitting the same {query, page, ...} key
// as an earlier test would silently get a stale cached promise instead of exercising the
// current test's MSW handler. See createCachedFetcher.ts's resetAllCachedFetchers docblock.
afterEach(() => resetAllCachedFetchers())
// genreDictionaryCache's localStorage slot + in-memory cooldown/in-flight state are module-
// level too — same rationale as resetAllCachedFetchers above, plus localStorage.clear() so a
// cached dictionary from one test doesn't leak into the next (see genreDictionaryCache.ts).
afterEach(() => {
  localStorage.clear()
  resetGenreDictionaryState()
})
afterAll(() => server.close())
