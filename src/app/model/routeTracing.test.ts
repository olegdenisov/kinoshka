import { urlAtom } from '@reatom/core'
import * as Sentry from '@sentry/react'

import { setTestUrl } from '../../test/router'
import {
  initRouteTracing,
  NOT_FOUND_SPAN_NAME,
  routeSpanName,
} from './routeTracing'

vi.mock('@sentry/react', async importOriginal => ({
  ...(await importOriginal<typeof Sentry>()),
  getClient: vi.fn(),
  startBrowserTracingPageLoadSpan: vi.fn(),
  startBrowserTracingNavigationSpan: vi.fn(),
}))

const client = { name: 'test-client' } as unknown as ReturnType<
  typeof Sentry.getClient
>

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

const pageloadSpans = () =>
  vi
    .mocked(Sentry.startBrowserTracingPageLoadSpan)
    .mock.calls.map(([, options]) => options)
const navigationSpans = () =>
  vi
    .mocked(Sentry.startBrowserTracingNavigationSpan)
    .mock.calls.map(([, options]) => options)

const start = (url = '/') => {
  setTestUrl(url)
  initRouteTracing()
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(Sentry.getClient).mockReturnValue(client)
})

describe('routeSpanName', () => {
  it('параметризует путь по шаблону роута', () => {
    expect(routeSpanName('/movie/1')).toBe('/movie/:id')
    expect(routeSpanName('/movie/2')).toBe('/movie/:id')
    expect(routeSpanName('/person/42')).toBe('/person/:id')
    expect(routeSpanName('/')).toBe('/')
  })

  it('неизвестный путь — одно фиксированное имя, а не сам путь', () => {
    expect(routeSpanName('/nope/123')).toBe(NOT_FOUND_SPAN_NAME)
    expect(routeSpanName('/other')).toBe(NOT_FOUND_SPAN_NAME)
  })
})

describe('initRouteTracing', () => {
  it('без клиента Sentry спаны не создаёт', async () => {
    vi.mocked(Sentry.getClient).mockReturnValue(undefined)

    start('/movie/1')
    urlAtom.go('/movie/2')
    await tick()

    expect(Sentry.startBrowserTracingPageLoadSpan).not.toHaveBeenCalled()
    expect(Sentry.startBrowserTracingNavigationSpan).not.toHaveBeenCalled()
  })

  it('pageload при старте — имя по шаблону роута, источник route', () => {
    start('/movie/1')

    expect(pageloadSpans()).toEqual([
      expect.objectContaining({
        name: '/movie/:id',
        attributes: expect.objectContaining({
          [Sentry.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: 'route',
        }),
      }),
    ])
    expect(
      vi.mocked(Sentry.startBrowserTracingPageLoadSpan),
    ).toHaveBeenCalledWith(client, expect.anything())
  })

  it('/movie/1 и /movie/2 дают одно имя транзакции', async () => {
    start('/movie/1')
    urlAtom.go('/movie/2')
    await tick()

    expect(pageloadSpans().map(span => span.name)).toEqual(['/movie/:id'])
    expect(navigationSpans()).toEqual([
      expect.objectContaining({
        name: '/movie/:id',
        attributes: expect.objectContaining({
          [Sentry.SEMANTIC_ATTRIBUTE_SENTRY_SOURCE]: 'route',
        }),
      }),
    ])
  })

  it('navigation на смену роута — в том числе кликом по <a>', async () => {
    start('/')
    const link = document.createElement('a')
    link.href = '/person/7'
    document.body.append(link)

    link.click()
    await tick()
    link.remove()

    expect(navigationSpans().map(span => span.name)).toEqual(['/person/:id'])
    expect(
      vi.mocked(Sentry.startBrowserTracingNavigationSpan),
    ).toHaveBeenCalledWith(client, expect.anything(), {
      url: `${window.location.origin}/person/7`,
    })
  })

  it('смена только query-параметров спан не создаёт', async () => {
    start('/search')

    urlAtom.go('/search?q=matrix', true)
    await tick()
    urlAtom.go('/search?q=matrix&page=2')
    await tick()

    expect(navigationSpans()).toEqual([])
  })

  it('неизвестный путь — фиксированное имя', async () => {
    start('/')
    urlAtom.go('/nope/123')
    await tick()

    expect(navigationSpans().map(span => span.name)).toEqual([
      NOT_FOUND_SPAN_NAME,
    ])
  })
})
