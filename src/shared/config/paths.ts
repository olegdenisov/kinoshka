type SearchInit = Record<string, string> | URLSearchParams

// Сериализацию фильтров делает вызывающий слой: shared о фильтрах ничего не знает.
const withSearch = (pathname: string, params?: SearchInit) => {
  const query = new URLSearchParams(params).toString()
  return query ? `${pathname}?${query}` : pathname
}

export const paths = {
  home: () => '/',
  movie: (id: string | number) => `/movie/${encodeURIComponent(id)}`,
  person: (id: string | number) => `/person/${encodeURIComponent(id)}`,
  favorites: () => '/favorites',
  watched: () => '/watched',
  watchlist: () => '/watchlist',
  popular: () => '/popular',
  recommendations: () => '/recommendations',
  search: (params?: SearchInit) => withSearch('/search', params),
  profile: () => '/profile',
}

export const ROUTE_PATTERNS = [
  '/',
  '/movie/:id',
  '/person/:id',
  '/favorites',
  '/watched',
  '/watchlist',
  '/popular',
  '/recommendations',
  '/search',
  '/profile',
] as const

export type RoutePattern = (typeof ROUTE_PATTERNS)[number]

/** Шаблон роута для пути (`/movie/1` → `/movie/:id`) или `null` для неизвестного пути. */
export const matchRoutePattern = (pathname: string): RoutePattern | null => {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname

  for (const pattern of ROUTE_PATTERNS) {
    if (!pattern.includes(':')) {
      if (pattern === normalized) return pattern
      continue
    }
    const prefix = pattern.slice(0, pattern.indexOf(':'))
    if (
      normalized.startsWith(prefix) &&
      normalized.length > prefix.length &&
      !normalized.slice(prefix.length).includes('/')
    ) {
      return pattern
    }
  }
  return null
}
