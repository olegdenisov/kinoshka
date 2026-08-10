import '@testing-library/jest-dom/vitest'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { resetAllCachedFetchers } from '@entities/movie'

export const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
// createCachedFetcher's in-memory cache is module-level (survives across tests within the
// same file and across files) — without this, tests hitting the same {query, page, ...} key
// as an earlier test would silently get a stale cached promise instead of exercising the
// current test's MSW handler. See createCachedFetcher.ts's resetAllCachedFetchers docblock.
afterEach(() => resetAllCachedFetchers())
afterAll(() => server.close())
