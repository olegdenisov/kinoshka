import { act, fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { server } from '../../../../test/setup'
import { HomeDesktop } from './HomeDesktop'

// Реальный retry (roadmap 1.6): рейл падает → ErrorState с Retry → клик реально бьёт
// в сеть заново (invalidateTopRatedMovies/invalidatePopularMovies из hooks/index.ts), а не
// просто перерисовывает тот же rejected-промис из cooldown. Только TopAnimeRails (единственный
// рейл на /v1.5/movie с уникальным ключом query — rating.kp + type=anime, никто другой его не
// делит) мокается падающим, чтобы у теста была ровно одна ErrorState-инстанция для клика.
const MOVIE_ENDPOINT = '*/v1.5/movie'
// PopularMoviesRail (Task 9) больше не делит эндпоинт/кэш с PersonalRails — теперь он
// на отдельном курируемом списке /v1.5/list/{slug} (usePopularMovies() → getPopularMovies).
const LIST_ENDPOINT = '*/v1.5/list/:slug'

const doc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Test Movie',
  year: 2024,
  rating: { kp: 8.1, imdb: 7.9 },
  type: 'movie',
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  ...overrides,
})

const successResponse = (docs: Record<string, unknown>[]) =>
  HttpResponse.json({ docs, total: docs.length, page: 1, pages: 1, limit: 10 })

const errorResponse = () =>
  HttpResponse.json(
    { statusCode: 500, message: 'boom', error: 'Internal Server Error' },
    { status: 500 },
  )

const popularListItem = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  positionDiff: 2,
  rating: 8.1,
  votes: 1000,
  movie: {
    id: 1,
    name: 'Popular Movie',
    year: 2024,
    movieLength: 120,
    poster: { previewUrl: 'https://example.com/poster.jpg' },
    rating: { kp: 8.1 },
  },
  ...overrides,
})

const popularListSuccessResponse = (docs: Record<string, unknown>[]) =>
  HttpResponse.json({
    name: 'Popular',
    slug: 'popular',
    movies: {
      docs,
      limit: 10,
      next: null,
      prev: null,
      hasNext: false,
      hasPrev: false,
    },
  })

const popularListErrorResponse = () =>
  HttpResponse.json(
    { statusCode: 500, message: 'boom', error: 'Internal Server Error' },
    { status: 500 },
  )

/** Единственный рейл с уникальным ключом query (rating.kp + type=anime) падает изначально
 * (первый запрос), остальные три рейла всегда успешны. После первого запроса TopAnimeRails
 * тоже начинает отвечать успехом — реальный второй запрос (после invalidate) его получит.
 * PopularMoviesRail мокается отдельным успешным хендлером на LIST_ENDPOINT — он больше не
 * делит эндпоинт с остальными тремя рейлами (все они на MOVIE_ENDPOINT). */
const mockMovies = () => {
  const requestsByKind = { topAnime: 0, other: 0 }

  server.use(
    http.get(MOVIE_ENDPOINT, ({ request }) => {
      const url = new URL(request.url)
      const hasRatingKp = url.searchParams.has('rating.kp')
      const type = url.searchParams.get('type')

      if (hasRatingKp && type === 'anime') {
        requestsByKind.topAnime += 1
        if (requestsByKind.topAnime === 1) {
          return errorResponse()
        }
        return successResponse([doc({ id: 99, name: 'Anime Recovered' })])
      }

      requestsByKind.other += 1
      return successResponse([doc({ id: 1, name: 'Other Movie' })])
    }),
    http.get(LIST_ENDPOINT, () =>
      popularListSuccessResponse([popularListItem()]),
    ),
  )

  return requestsByKind
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  // HomeDesktop renders Header, whose ThemeToggle applies data-theme on
  // document.documentElement — jsdom document общий между тестами файла, сбрасываем, чтобы
  // тема, выставленная одним тестом, не утекала в следующий (см. Header.test.tsx).
  document.documentElement.removeAttribute('data-theme')
})

describe('HomeDesktop — реальный retry для рейлов', () => {
  it('рейл с ошибкой показывает ErrorState с Retry; клик реально бьёт в сеть и рендерит данные', async () => {
    const requestsByKind = mockMovies()

    await act(async () => {
      render(
        <MemoryRouter>
          <HomeDesktop />
        </MemoryRouter>,
      )
    })

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(requestsByKind.topAnime).toBe(1)

    // остальные три рейла успешны и уже отрендерили карточки
    expect(screen.getAllByText('Other Movie').length).toBeGreaterThan(0)
    expect(screen.queryByText('Anime Recovered')).not.toBeInTheDocument()

    const retryButton = screen.getByText('Попробовать снова')

    await act(async () => {
      fireEvent.click(retryButton)
    })

    // новый реальный запрос, не тот же rejected-промис
    expect(requestsByKind.topAnime).toBe(2)
    expect(screen.getByText('Anime Recovered')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('PopularMoviesRail (/v1.5/list/popular) и PersonalRails (/v1.5/movie, rating.kp без type) — независимые эндпоинты/кэши, падают и восстанавливаются раздельным retry, не влияя друг на друга', async () => {
    const requestsByKind = { popularList: 0, sharedTopRated: 0, other: 0 }

    server.use(
      http.get(LIST_ENDPOINT, () => {
        requestsByKind.popularList += 1
        if (requestsByKind.popularList === 1) {
          return popularListErrorResponse()
        }
        return popularListSuccessResponse([
          popularListItem({
            movie: {
              id: 42,
              name: 'Popular Recovered',
              year: 2024,
              movieLength: 120,
              poster: { previewUrl: 'https://example.com/poster.jpg' },
              rating: { kp: 8.1 },
            },
          }),
        ])
      }),
      http.get(MOVIE_ENDPOINT, ({ request }) => {
        const url = new URL(request.url)
        const hasRatingKp = url.searchParams.has('rating.kp')
        const hasType = url.searchParams.has('type')

        // rating.kp без type — теперь исключительно PersonalRails (PopularMoviesRail
        // переехал на LIST_ENDPOINT в Task 9).
        if (hasRatingKp && !hasType) {
          requestsByKind.sharedTopRated += 1
          if (requestsByKind.sharedTopRated === 1) {
            return errorResponse()
          }
          return successResponse([doc({ id: 43, name: 'Personal Recovered' })])
        }

        requestsByKind.other += 1
        return successResponse([doc({ id: 1, name: 'Other Movie' })])
      }),
    )

    await act(async () => {
      render(
        <MemoryRouter>
          <HomeDesktop />
        </MemoryRouter>,
      )
    })

    // Раздельные кэш-ключи/эндпоинты -> два независимых сетевых запроса, оба падают.
    expect(requestsByKind.popularList).toBe(1)
    expect(requestsByKind.sharedTopRated).toBe(1)
    expect(screen.getAllByText('Something went wrong')).toHaveLength(2)

    const retryButtons = screen.getAllByText('Попробовать снова')
    expect(retryButtons).toHaveLength(2)

    // Клик по retry только PopularMoviesRail (первый рейл в DOM-порядке HomeDesktop).
    await act(async () => {
      fireEvent.click(retryButtons[0])
    })

    expect(requestsByKind.popularList).toBe(2)
    // PersonalRails никак не задет retry-ем PopularMoviesRail — раздельные кэши.
    expect(requestsByKind.sharedTopRated).toBe(1)
    expect(screen.getByText('Popular Recovered')).toBeInTheDocument()
    expect(screen.getAllByText('Something went wrong')).toHaveLength(1)

    // Клик по retry оставшегося рейла (PersonalRails).
    const remainingRetryButton = screen.getByText('Попробовать снова')

    await act(async () => {
      fireEvent.click(remainingRetryButton)
    })

    expect(requestsByKind.sharedTopRated).toBe(2)
    expect(requestsByKind.popularList).toBe(2)
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(screen.getByText('Personal Recovered')).toBeInTheDocument()
  })

  it('без ошибок все 4 рейла рендерят данные, EmptyState/ErrorState отсутствуют', async () => {
    server.use(
      http.get(MOVIE_ENDPOINT, () =>
        successResponse([doc({ id: 1, name: 'Any Movie' })]),
      ),
      http.get(LIST_ENDPOINT, () =>
        popularListSuccessResponse([popularListItem()]),
      ),
    )

    await act(async () => {
      render(
        <MemoryRouter>
          <HomeDesktop />
        </MemoryRouter>,
      )
    })

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
    expect(screen.getAllByText('Any Movie').length).toBeGreaterThan(0)
    expect(screen.getByText('Popular Movie')).toBeInTheDocument()
  })
})
