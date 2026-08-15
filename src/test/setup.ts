import '@testing-library/jest-dom/vitest'
import { resetAllCachedFetchers } from '@entities/movie'
import { resetGenreDictionaryState } from '@entities/movie/api/genreDictionaryCache'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'

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
