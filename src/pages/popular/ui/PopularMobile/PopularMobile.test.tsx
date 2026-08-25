import { act, fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { server } from '../../../../test/setup'
import { PopularMobile } from './PopularMobile'

// Реальные MSW-хендлеры на /v1.5/list/:slug (не мок модуля) — тот же подход, что и
// PopularDesktop.test.tsx: usePopularMovies()/invalidatePopularMovies() делят один и тот же
// реальный createCachedFetcher-кэш, так что клик Retry по-настоящему инвалидирует и бьёт в сеть
// заново, а не просто перерисовывает закэшированный rejected-промис.
const LIST_ENDPOINT = '*/v1.5/list/:slug'

const movieDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  name: 'Popular Movie',
  year: 2024,
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  rating: { kp: 8.1, imdb: 7.9 },
  ...overrides,
})

const listItem = (overrides: Record<string, unknown> = {}) => ({
  position: 1,
  positionDiff: 2,
  rating: 8.1,
  votes: 1000,
  movie: movieDoc(),
  ...overrides,
})

const successResponse = (docs: Record<string, unknown>[]) =>
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

const errorResponse = () =>
  HttpResponse.json(
    { statusCode: 500, message: 'boom', error: 'Internal Server Error' },
    { status: 500 },
  )

const renderPage = async () => {
  let result: ReturnType<typeof render> | undefined

  await act(async () => {
    result = render(
      <MemoryRouter>
        <PopularMobile />
      </MemoryRouter>,
    )
  })

  return result!
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  // PopularMobile renders MobileHeader → ThemeToggle, который выставляет data-theme на
  // document.documentElement — сбрасываем, чтобы значение не утекало в следующий тест (см.
  // useTheme.test.tsx).
  document.documentElement.removeAttribute('data-theme')
})

describe('PopularMobile — успешная загрузка', () => {
  it('рендерит карточки с rank-бейджами', async () => {
    server.use(
      http.get(LIST_ENDPOINT, () =>
        successResponse([
          listItem({ movie: movieDoc({ id: 1, name: 'First Popular' }) }),
          listItem({
            position: 2,
            positionDiff: -1,
            movie: movieDoc({ id: 2, name: 'Second Popular' }),
          }),
        ]),
      ),
    )

    await renderPage()

    expect(await screen.findByText('First Popular')).toBeInTheDocument()
    expect(screen.getByText('Second Popular')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
  })
})

describe('PopularMobile — пустой список', () => {
  it('пустой docs[] рендерит EmptyState, а не пустой грид', async () => {
    server.use(http.get(LIST_ENDPOINT, () => successResponse([])))

    await renderPage()

    expect(
      await screen.findByText('No popular movies right now'),
    ).toBeInTheDocument()
  })
})

describe('PopularMobile — полный отказ загрузки', () => {
  it('показывает error-фолбэк AsyncBoundary с Retry, а Retry реально бьёт в сеть заново', async () => {
    let requests = 0
    server.use(
      http.get(LIST_ENDPOINT, () => {
        requests += 1
        if (requests === 1) return errorResponse()
        return successResponse([
          listItem({ movie: movieDoc({ id: 7, name: 'Recovered Popular' }) }),
        ])
      }),
    )

    await renderPage()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(requests).toBe(1)

    await act(async () => {
      fireEvent.click(screen.getByText('Попробовать снова'))
    })

    expect(requests).toBe(2)
    expect(await screen.findByText('Recovered Popular')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
