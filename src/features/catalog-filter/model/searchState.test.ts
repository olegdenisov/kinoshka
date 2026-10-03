import { urlAtom } from '@reatom/core'
import type * as SharedLib from '@shared/lib'

import { EMPTY_FILTERS } from '../lib/searchParams'
import {
  activeChips,
  catalogParams,
  commitSearchDraft,
  filters,
  goToPage,
  normalizeSearchUrl,
  page,
  QUERY_DEBOUNCE_MS,
  removeFilterChip,
  resetFilters,
  searchDraft,
  searchQuery,
  setFilters,
  setSort,
  sort,
  submitSearchQuery,
  toggleGenre,
} from './searchState'

vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

// urlAtom пишет в history через setTimeout(0) — ждём, пока запись дойдёт до location.
const flushHistory = () => new Promise(resolve => setTimeout(resolve, 0))

const currentUrl = () => window.location.pathname + window.location.search

// URL выставляется до первого чтения urlAtom: после context.reset() он инициализируется из location.
const openUrl = (url: string) => {
  window.history.replaceState(null, '', url)
  urlAtom()
}

const spyHistory = () => ({
  replace: vi.spyOn(window.history, 'replaceState'),
  push: vi.spyOn(window.history, 'pushState'),
})

beforeEach(() => {
  vi.mocked(trackEvent).mockClear()
  // jsdom не реализует scrollTo; goToPage зовёт его на каждую запись страницы.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

// Отложенная запись в history из теста не должна долететь до шпионов следующего.
afterEach(async () => {
  await flushHistory()
  vi.restoreAllMocks()
})

describe('чтение', () => {
  it('пустой /search → дефолты', () => {
    openUrl('/search')

    expect(filters()).toEqual(EMPTY_FILTERS)
    expect(searchQuery()).toBe('')
    expect(sort()).toBe('')
    expect(page()).toBe(1)
    expect(activeChips()).toEqual([])
  })

  it('читает фильтры, сортировку и страницу', () => {
    openUrl('/search?type=movie&genres=драма&yearFrom=2020&sort=Newest&page=4')

    expect(filters()).toEqual({
      ...EMPTY_FILTERS,
      type: 'movie',
      genres: ['драма'],
      yearFrom: 2020,
    })
    expect(sort()).toBe('Newest')
    expect(page()).toBe(4)
    expect(activeChips()).toEqual([
      { id: 'type', label: 'Movies' },
      { id: 'genre:драма', label: expect.any(String) },
      { id: 'year', label: '2020+' },
    ])
    expect(catalogParams()).toMatchObject({
      type: ['movie'],
      'genres.name': ['драма'],
      year: ['2020-2050'],
      sortField: ['year'],
    })
  })

  it('мусор в параметрах даёт дефолты', () => {
    openUrl('/search?yearFrom=abc&rating=99&sort=Random&page=zzz')

    expect(filters()).toEqual(EMPTY_FILTERS)
    expect(sort()).toBe('')
    expect(page()).toBe(1)
  })

  it.each([
    ['0', 1],
    ['-3', 1],
    ['11', 10],
    ['7', 7],
  ])('page=%s ограничивается диапазоном 1–10 → %d', (raw, expected) => {
    openUrl(`/search?page=${raw}`)

    expect(page()).toBe(expected)
  })

  it('вне /search состояние пустое', () => {
    openUrl('/favorites?q=batman&genres=драма&page=3&sort=Newest')

    expect(searchQuery()).toBe('')
    expect(filters()).toEqual(EMPTY_FILTERS)
    expect(page()).toBe(1)
    expect(sort()).toBe('')
  })

  it('filters структурно стабилен при смене посторонних параметров', () => {
    openUrl('/search?genres=драма')
    const before = filters()

    goToPage(3)

    expect(filters()).toBe(before)
  })
})

describe('запись', () => {
  it.each([
    [
      'setFilters',
      () => setFilters(f => ({ ...f, rating: 7 })),
      '/search?page=1&genres=драма&rating=7',
    ],
    [
      'toggleGenre',
      () => toggleGenre('боевик'),
      '/search?page=1&genres=драма%2Cбоевик',
    ],
    ['resetFilters', () => resetFilters(), '/search?page=1'],
    [
      'removeFilterChip',
      () => removeFilterChip('genre:драма'),
      '/search?page=1',
    ],
  ])(
    '%s сбрасывает page одной записью replaceState',
    async (_, mutate, expected) => {
      openUrl('/search?genres=драма&page=5')
      const history = spyHistory()

      mutate()
      await flushHistory()

      expect(decodeURIComponent(currentUrl())).toBe(
        decodeURIComponent(expected),
      )
      expect(history.replace).toHaveBeenCalledTimes(1)
      expect(history.push).not.toHaveBeenCalled()
      expect(trackEvent).toHaveBeenCalledWith('filter changed')
    },
  )

  it('removeFilterChip снимает конкретное значение множественного фильтра', async () => {
    openUrl('/search?countries=США,Россия&type=anime')

    removeFilterChip('country:США')
    removeFilterChip('type')
    await flushHistory()

    expect(filters()).toEqual({ ...EMPTY_FILTERS, countries: ['Россия'] })
  })

  it('setSort сохраняет страницу и не трекает filter changed', async () => {
    openUrl('/search?genres=драма&page=5')
    const history = spyHistory()

    setSort('Newest')
    await flushHistory()

    expect(currentUrl()).toBe(
      '/search?genres=%D0%B4%D1%80%D0%B0%D0%BC%D0%B0&page=5&sort=Newest',
    )
    expect(page()).toBe(5)
    expect(history.replace).toHaveBeenCalledTimes(1)
    expect(trackEvent).not.toHaveBeenCalled()

    setSort('')
    await flushHistory()
    expect(sort()).toBe('')
    expect(window.location.search).not.toContain('sort')
  })

  it('goToPage пишет страницу (с ограничением) и плавно скроллит наверх', async () => {
    openUrl('/search?q=batman')
    const history = spyHistory()

    goToPage(42)
    await flushHistory()

    expect(currentUrl()).toBe('/search?q=batman&page=10')
    expect(history.replace).toHaveBeenCalledTimes(1)
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('submitSearchQuery из режима фильтров оставляет в URL только q', async () => {
    openUrl('/search?genres=драма&sort=Newest&page=4&rating=7')
    const history = spyHistory()

    submitSearchQuery('  batman ')
    await flushHistory()

    expect(currentUrl()).toBe('/search?q=batman')
    expect(history.replace).toHaveBeenCalledTimes(1)
  })

  it('запрос короче порога не пишется в ?q и стирает прежний', async () => {
    openUrl('/search?q=batman&page=3')

    submitSearchQuery('b')
    await flushHistory()

    expect(currentUrl()).toBe('/search')
  })

  it('тот же запрос не пишет в history', async () => {
    openUrl('/search?q=batman&page=3')
    const history = spyHistory()

    submitSearchQuery('batman ')
    await flushHistory()

    expect(currentUrl()).toBe('/search?q=batman&page=3')
    expect(history.replace).not.toHaveBeenCalled()
  })

  it('мутация вне /search URL не трогает', async () => {
    openUrl('/favorites?x=1')
    const history = spyHistory()

    setFilters(f => ({ ...f, rating: 7 }))
    submitSearchQuery('batman')
    await flushHistory()

    expect(currentUrl()).toBe('/favorites?x=1')
    expect(history.replace).not.toHaveBeenCalled()
  })
})

describe('normalizeSearchUrl', () => {
  it('в текстовом режиме вычищает фильтры и сортировку, страницу сохраняет', async () => {
    openUrl('/search?q=batman&page=3&genres=драма&sort=Newest')

    normalizeSearchUrl()
    await flushHistory()

    expect(currentUrl()).toBe('/search?q=batman&page=3')
  })

  it('в режиме фильтров ничего не пишет', async () => {
    openUrl('/search?genres=драма&sort=Newest')
    const history = spyHistory()

    normalizeSearchUrl()
    await flushHistory()

    expect(history.replace).not.toHaveBeenCalled()
  })
})

describe('searchDraft', () => {
  it('стартует из ?q и принимает прямую запись', () => {
    openUrl('/search?q=batman')
    const unsubscribe = searchDraft.subscribe(() => {})

    expect(searchDraft()).toBe('batman')
    searchDraft.set('batm')
    expect(searchDraft()).toBe('batm')

    unsubscribe()
  })

  it('следует за URL при back/forward', async () => {
    openUrl('/search?q=first')
    const unsubscribe = searchDraft.subscribe(() => {})

    urlAtom.go('/search?q=second')
    await flushHistory()
    expect(searchDraft()).toBe('second')

    searchDraft.set('typing')
    window.history.back()
    await vi.waitFor(() => expect(searchQuery()).toBe('first'))
    expect(searchDraft()).toBe('first')

    unsubscribe()
  })

  it('собственный коммит не стирает пробел и короткий ввод', async () => {
    openUrl('/search?q=batman')
    const unsubscribe = searchDraft.subscribe(() => {})

    searchDraft.set('bat ')
    submitSearchQuery(searchDraft())
    expect(searchQuery()).toBe('bat')
    expect(searchDraft()).toBe('bat ')

    searchDraft.set('b')
    submitSearchQuery(searchDraft())
    expect(searchQuery()).toBe('')
    expect(searchDraft()).toBe('b')

    unsubscribe()
  })

  it('быстрый ввод даёт одну запись после debounce', async () => {
    openUrl('/search')
    const unsubscribe = searchDraft.subscribe(() => {})
    const history = spyHistory()

    for (const value of ['ba', 'bat', 'batm', 'batman']) {
      searchDraft.set(value)
      commitSearchDraft()
    }

    await flushHistory()
    expect(history.replace).not.toHaveBeenCalled()

    await vi.waitFor(() => expect(currentUrl()).toBe('/search?q=batman'), {
      timeout: QUERY_DEBOUNCE_MS * 4,
    })
    expect(history.replace).toHaveBeenCalledTimes(1)

    unsubscribe()
  })
})
