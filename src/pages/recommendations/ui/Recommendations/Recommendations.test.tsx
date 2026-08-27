import { act, fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { server } from '../../../../test/setup'
import { Recommendations } from './Recommendations'

// Реальные MSW-хендлеры (не мок модуля) на /v1.5/movie/:id (favorites, через getMoviesByIds)
// и /v1.5/movie (каталог, через getMoviesPage) — тот же подход, что FavoritesDesktop.test.tsx/
// PopularDesktop.test.tsx: composed-хук (useRecommendedMovies) делит один и тот же реальный
// createCachedFetcher-кэш, так что Retry по-настоящему инвалидирует и бьёт в сеть заново.
const FAVORITES_KEY = 'kinoshka:favorites'
const MOVIE_ENDPOINT = (id: number) => `*/v1.5/movie/${id}`
const CATALOG_ENDPOINT = '*/v1.5/movie'

const setFavorites = (ids: number[]) =>
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))

const favoriteDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Favorite ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'драма' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  ...overrides,
})

const catalogDoc = (id: number, name: string) => ({
  id,
  name,
  year: 2023,
  type: 'movie',
  rating: { kp: 7.2, imdb: 7.0 },
  genres: [{ name: 'драма' }],
  movieLength: 100,
  poster: { previewUrl: 'https://example.com/catalog.jpg' },
})

const mockFavorite = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(MOVIE_ENDPOINT(id), () =>
      HttpResponse.json(favoriteDoc(id, overrides)),
    ),
  )
}

const mockFavoriteNotFound = (id: number) => {
  server.use(
    http.get(MOVIE_ENDPOINT(id), () =>
      HttpResponse.json(
        {
          statusCode: 404,
          message: `Not found movie with id ${id}`,
          error: 'Not Found',
        },
        { status: 404 },
      ),
    ),
  )
}

const mockCatalog = (
  docs: Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) => {
  let request: Request | undefined
  server.use(
    http.get(CATALOG_ENDPOINT, ({ request: req }) => {
      request = req
      return HttpResponse.json({
        docs,
        limit: 12,
        next: null,
        hasNext: false,
        hasPrev: false,
        total: docs.length,
        ...overrides,
      })
    }),
  )
  return { getRequest: () => request }
}

// useViewport() читает window.innerWidth только один раз при монтировании (см.
// useViewport.ts) — задаём ширину до рендера, resize-событие диспатчить не нужно.
const DESKTOP_WIDTH = 1280
const MOBILE_WIDTH = 375

const setViewportWidth = (width: number) => {
  window.innerWidth = width
}

const renderPage = async () => {
  let result: ReturnType<typeof render> | undefined

  await act(async () => {
    result = render(
      <MemoryRouter>
        <Recommendations />
      </MemoryRouter>,
    )
  })

  return result!
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setViewportWidth(DESKTOP_WIDTH)
})

// Recommendations больше не рендерит Header/MobileHeader/BottomNav сам (Task 6 плана
// docs/plans/20260827-mobile-first-adaptive-layout.md вынес выбор chrome в `AppLayout`,
// `src/app/layouts/AppLayout.tsx`) — навигационный chrome теперь тестируется отдельно, в
// `AppLayout.test.tsx`. `setViewportWidth`/`DESKTOP_WIDTH`/`MOBILE_WIDTH` остаются в этом файле
// не для chrome, а для тестов ниже, проверяющих, что контент не завязан на ширину окна.

describe('Recommendations — пустой список избранного', () => {
  it('рендерит EmptyState без сетевых запросов', async () => {
    await renderPage()

    expect(screen.getByText('No favorites yet')).toBeInTheDocument()
    expect(
      screen.getByText('Add movies you like to get recommendations'),
    ).toBeInTheDocument()
  })

  it('на мобильной ширине тоже рендерит EmptyState без сетевых запросов', async () => {
    setViewportWidth(MOBILE_WIDTH)
    await renderPage()

    expect(screen.getByText('No favorites yet')).toBeInTheDocument()
  })
})

describe('Recommendations — непустое избранное, успешный подбор', () => {
  it('рендерит карточки рекомендаций; исходящий запрос реально содержит id/genres.name/rating.kp правила', async () => {
    setFavorites([601, 602])
    mockFavorite(601, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(602, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })
    const { getRequest } = mockCatalog([catalogDoc(701, 'Recommended Movie')])

    await renderPage()

    expect(await screen.findByText('Recommended Movie')).toBeInTheDocument()

    const url = new URL(getRequest()!.url)
    expect(url.searchParams.getAll('id')).toEqual(['!601', '!602'])
    expect(url.searchParams.getAll('genres.name')).toEqual(['триллер', 'драма'])
    expect(url.searchParams.getAll('rating.kp')).toEqual(['6.0-10'])
    expect(url.searchParams.getAll('sortField')).toEqual(['rating.kp'])
    expect(url.searchParams.getAll('sortType')).toEqual(['-1'])

    // Без кнопки-сердечка на этой странице (см. Technical Details плана
    // 20260825-recommendations-rule-based.md) — Card получает isFavorite/onToggleFavorite оба
    // undefined, так что кнопка избранного не рендерится.
    expect(
      screen.queryByRole('button', { name: 'Add to favorites' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Remove from favorites' }),
    ).not.toBeInTheDocument()
  })

  it('на мобильной ширине карточки рекомендаций тоже рендерятся', async () => {
    setViewportWidth(MOBILE_WIDTH)
    setFavorites([601, 602])
    mockFavorite(601, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(602, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })
    mockCatalog([catalogDoc(701, 'Recommended Movie')])

    await renderPage()

    expect(await screen.findByText('Recommended Movie')).toBeInTheDocument()
  })
})

describe('Recommendations — все избранные id 404-нулись', () => {
  it('useRecommendedMovies возвращает null → EmptyState "не удалось загрузить избранное"', async () => {
    setFavorites([801, 802])
    mockFavoriteNotFound(801)
    mockFavoriteNotFound(802)
    let catalogRequests = 0
    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        catalogRequests += 1
        return HttpResponse.json({
          docs: [],
          limit: 12,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 0,
        })
      }),
    )

    await renderPage()

    expect(
      await screen.findByText("Couldn't load your favorites"),
    ).toBeInTheDocument()
    expect(catalogRequests).toBe(0)
  })
})

describe('Recommendations — каталог не вернул совпадений', () => {
  it('useRecommendedMovies возвращает [] → EmptyState "Nothing to recommend yet"', async () => {
    setFavorites([603, 604])
    mockFavorite(603, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(604, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })
    mockCatalog([])

    await renderPage()

    expect(
      await screen.findByText('Nothing to recommend yet'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Add a few more favorites to help us find matches'),
    ).toBeInTheDocument()
  })
})

describe('Recommendations — Retry реально переинвалидирует кэш каталога, а не только избранного', () => {
  it('клик Retry вызывает invalidateRecommendations и повторно запрашивает каталог', async () => {
    setFavorites([605, 606])
    mockFavorite(605, { genres: [{ name: 'триллер' }], rating: { kp: 8.0 } })
    mockFavorite(606, { genres: [{ name: 'драма' }], rating: { kp: 6.0 } })

    let catalogRequests = 0
    server.use(
      http.get(CATALOG_ENDPOINT, () => {
        catalogRequests += 1
        if (catalogRequests === 1) {
          return HttpResponse.json(
            {
              statusCode: 500,
              message: 'boom',
              error: 'Internal Server Error',
            },
            { status: 500 },
          )
        }
        return HttpResponse.json({
          docs: [catalogDoc(1002, 'Recovered Recommendation')],
          limit: 12,
          next: null,
          hasNext: false,
          hasPrev: false,
          total: 1,
        })
      }),
    )

    await renderPage()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(catalogRequests).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByText('Попробовать снова'))
    })

    expect(catalogRequests).toBe(2)
    expect(
      await screen.findByText('Recovered Recommendation'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
