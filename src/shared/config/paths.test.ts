import { describe, expect, it } from 'vitest'

import { matchRoutePattern, paths, ROUTE_PATTERNS } from './paths'

describe('paths', () => {
  it('строит статические пути', () => {
    expect(paths.home()).toBe('/')
    expect(paths.favorites()).toBe('/favorites')
    expect(paths.watched()).toBe('/watched')
    expect(paths.watchlist()).toBe('/watchlist')
    expect(paths.popular()).toBe('/popular')
    expect(paths.recommendations()).toBe('/recommendations')
    expect(paths.profile()).toBe('/profile')
  })

  it('кодирует id', () => {
    expect(paths.movie(42)).toBe('/movie/42')
    expect(paths.person('a/b?c')).toBe('/person/a%2Fb%3Fc')
  })

  it('search без параметров и с пустыми параметрами — без "?"', () => {
    expect(paths.search()).toBe('/search')
    expect(paths.search({})).toBe('/search')
    expect(paths.search(new URLSearchParams())).toBe('/search')
  })

  it('search с параметрами из Record и URLSearchParams', () => {
    expect(paths.search({ q: 'a b' })).toBe('/search?q=a+b')
    expect(paths.search(new URLSearchParams({ type: 'movie' }))).toBe(
      '/search?type=movie',
    )
  })
})

describe('matchRoutePattern', () => {
  it.each([
    ['/', '/'],
    ['/movie/1', '/movie/:id'],
    ['/person/7', '/person/:id'],
    ['/favorites', '/favorites'],
    ['/watched', '/watched'],
    ['/watchlist', '/watchlist'],
    ['/popular', '/popular'],
    ['/recommendations', '/recommendations'],
    ['/search', '/search'],
    ['/profile', '/profile'],
  ])('%s → %s', (pathname, pattern) => {
    expect(matchRoutePattern(pathname)).toBe(pattern)
  })

  it('покрывает все десять шаблонов', () => {
    expect(ROUTE_PATTERNS).toHaveLength(10)
  })

  it('разные id дают один шаблон', () => {
    expect(matchRoutePattern('/movie/1')).toBe(matchRoutePattern('/movie/2'))
  })

  it('игнорирует хвостовой слэш', () => {
    expect(matchRoutePattern('/search/')).toBe('/search')
    expect(matchRoutePattern('/movie/1/')).toBe('/movie/:id')
  })

  it('неизвестный путь → null', () => {
    expect(matchRoutePattern('/nope')).toBeNull()
    expect(matchRoutePattern('/movie')).toBeNull()
    expect(matchRoutePattern('/movie/')).toBeNull()
    expect(matchRoutePattern('/movie/1/cast')).toBeNull()
  })
})
