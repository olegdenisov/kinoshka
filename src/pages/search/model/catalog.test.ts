import { urlAtom } from '@reatom/core'
import type * as SharedLib from '@shared/lib'
import { delay, http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { catalog } from './catalog'

vi.mock('@shared/lib', async importOriginal => {
  const actual = await importOriginal<typeof SharedLib>()
  return { ...actual, trackEvent: vi.fn() }
})

const { trackEvent } = await import('@shared/lib')

const SEARCH_ENDPOINT = '*/v1.5/movie/search'
const CATALOG_ENDPOINT = '*/v1.5/movie'

const doc = (id: number) => ({
  id,
  name: `Movie ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
})

// id фильма в выдаче поиска кодирует запрос и страницу: код первой буквы * 100 + страница.
const searchId = (query: string, page: number) =>
  query.charCodeAt(0) * 100 + page

const mockSearch = ({ slowQuery }: { slowQuery?: string } = {}) => {
  const requests: string[] = []
  server.use(
    http.get(SEARCH_ENDPOINT, async ({ request }) => {
      const url = new URL(request.url)
      const query = url.searchParams.get('query') ?? ''
      const page = Number(url.searchParams.get('page'))
      requests.push(`${query}#${page}`)
      if (query === slowQuery) await delay(100)
      return HttpResponse.json({
        docs: [doc(searchId(query, page))],
        pages: 5,
        limit: 12,
      })
    }),
  )
  return requests
}

const mockCatalog = () => {
  const requests: URL[] = []
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request }) => {
      requests.push(new URL(request.url))
      return HttpResponse.json({
        docs: [doc(1)],
        limit: 12,
        next: null,
        total: 12,
      })
    }),
  )
  return requests
}

const flushHistory = () => new Promise(resolve => setTimeout(resolve, 0))

const currentUrl = () => window.location.pathname + window.location.search

const openUrl = (url: string) => {
  window.history.replaceState(null, '', url)
  urlAtom()
}

const movieIds = () => catalog.data().movies.map(movie => movie.id)

let unsubscribe = () => {}

const connect = () => {
  unsubscribe = catalog.subscribe(() => {})
}

beforeEach(() => {
  vi.mocked(trackEvent).mockClear()
})

afterEach(async () => {
  unsubscribe()
  unsubscribe = () => {}
  // Сначала реальные таймеры: flushHistory ждёт настоящий setTimeout.
  vi.useRealTimers()
  await flushHistory()
})

describe('catalog — режимы', () => {
  it('непустой ?q → текстовый поиск, фильтры не участвуют', async () => {
    const search = mockSearch()
    const catalogRequests = mockCatalog()
    openUrl('/search?q=matrix&page=2')
    connect()

    await vi.waitFor(() => expect(movieIds()).toEqual([searchId('matrix', 2)]))
    expect(catalog.data()).toMatchObject({ mode: 'search', totalPages: 5 })
    expect(search).toEqual(['matrix#2'])
    expect(catalogRequests).toHaveLength(0)
  })

  it('пустой ?q → каталог по фильтрам', async () => {
    const search = mockSearch()
    const catalogRequests = mockCatalog()
    openUrl('/search?genres=драма&sort=Newest')
    connect()

    await vi.waitFor(() => expect(movieIds()).toEqual([1]))
    expect(catalog.data()).toMatchObject({ mode: 'catalog', totalPages: 1 })
    expect(search).toHaveLength(0)
    expect(catalogRequests[0].searchParams.getAll('genres.name')).toEqual([
      'драма',
    ])
    expect(catalogRequests[0].searchParams.getAll('sortField')).toEqual([
      'year',
    ])
  })
})

describe('catalog — загрузка', () => {
  it('возврат на уже загруженную страницу не шлёт запрос', async () => {
    const search = mockSearch()
    openUrl('/search?q=matrix')
    connect()
    await vi.waitFor(() => expect(movieIds()).toEqual([searchId('matrix', 1)]))

    urlAtom.go('/search?q=matrix&page=2', true)
    await vi.waitFor(() => expect(movieIds()).toEqual([searchId('matrix', 2)]))

    urlAtom.go('/search?q=matrix', true)
    await vi.waitFor(() => expect(movieIds()).toEqual([searchId('matrix', 1)]))

    expect(search).toEqual(['matrix#1', 'matrix#2'])
  })

  it('старые данные остаются во время обновления', async () => {
    mockSearch({ slowQuery: 'slow' })
    openUrl('/search?q=matrix')
    connect()
    await vi.waitFor(() => expect(movieIds()).toEqual([searchId('matrix', 1)]))

    urlAtom.go('/search?q=slow', true)

    await vi.waitFor(() => expect(catalog.status().isPending).toBe(true))
    expect(catalog.status().isFirstPending).toBe(false)
    expect(movieIds()).toEqual([searchId('matrix', 1)])

    await vi.waitFor(() => expect(movieIds()).toEqual([searchId('slow', 1)]))
    expect(catalog.status().isPending).toBe(false)
  })

  it('ответ устаревшего запроса не перезаписывает результат более нового', async () => {
    const search = mockSearch({ slowQuery: 'slow' })
    openUrl('/search?q=slow')
    connect()
    await vi.waitFor(() => expect(search).toEqual(['slow#1']))

    urlAtom.go('/search?q=fast', true)
    await vi.waitFor(() => expect(movieIds()).toEqual([searchId('fast', 1)]))

    // Медленный ответ уже пришёл бы — результат остаётся за новым запросом.
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(movieIds()).toEqual([searchId('fast', 1)])
    expect(catalog.data().mode).toBe('search')
  })
})

describe('catalog — нормализация URL', () => {
  it('deep-link с ?q и фильтрами: страница сохраняется, фильтры и сортировка вычищены', async () => {
    mockSearch()
    openUrl('/search?q=matrix&page=3&genres=драма&sort=Newest')
    connect()

    await vi.waitFor(() => expect(currentUrl()).toBe('/search?q=matrix&page=3'))
  })

  it('переход на «грязный» URL без переподключения каталога', async () => {
    mockSearch()
    mockCatalog()
    openUrl('/search?genres=драма')
    connect()
    await vi.waitFor(() => expect(movieIds()).toEqual([1]))

    urlAtom.go('/search?q=matrix&page=3&genres=драма&sort=Newest')

    await vi.waitFor(() => expect(currentUrl()).toBe('/search?q=matrix&page=3'))
  })
})

describe('catalog — search submitted', () => {
  it('уходит один раз на каждое новое значение q, а не только при подключении', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mockSearch()
    openUrl('/search?q=matrix')
    connect()

    await vi.advanceTimersByTimeAsync(800)
    expect(trackEvent).toHaveBeenCalledTimes(1)
    expect(trackEvent).toHaveBeenCalledWith('search submitted')

    // Серия быстрых смен ?q — одно событие после того, как значение устоялось.
    urlAtom.go('/search?q=matr', true)
    await vi.advanceTimersByTimeAsync(300)
    urlAtom.go('/search?q=batman', true)
    await vi.advanceTimersByTimeAsync(800)
    expect(trackEvent).toHaveBeenCalledTimes(2)

    // Смена страницы при том же запросе — не новый поиск.
    urlAtom.go('/search?q=batman&page=2', true)
    await vi.advanceTimersByTimeAsync(800)
    expect(trackEvent).toHaveBeenCalledTimes(2)

    // Очистка и повторный ввод того же текста — новый поиск.
    urlAtom.go('/search', true)
    await vi.advanceTimersByTimeAsync(800)
    urlAtom.go('/search?q=batman', true)
    await vi.advanceTimersByTimeAsync(800)
    expect(trackEvent).toHaveBeenCalledTimes(3)
  })

  it('режим фильтров событие не шлёт', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    mockCatalog()
    openUrl('/search?genres=драма')
    connect()

    await vi.advanceTimersByTimeAsync(1000)

    expect(trackEvent).not.toHaveBeenCalled()
  })
})
