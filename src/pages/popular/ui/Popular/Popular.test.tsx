import { act, fireEvent, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { server } from '../../../../test/setup'
import { Popular } from './Popular'

// Реальные MSW-хендлеры на /v1.5/list/:slug (не мок модуля) — тот же подход, что и
// HomeDesktop.test.tsx для PopularMoviesRail: usePopularMovies()/invalidatePopularMovies() делят
// один и тот же реальный createCachedFetcher-кэш, так что клик Retry по-настоящему инвалидирует
// и бьёт в сеть заново, а не просто перерисовывает закэшированный rejected-промис.
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
        <Popular />
      </MemoryRouter>,
    )
  })

  return result!
}

beforeEach(() => {
  vi.stubEnv('DEV', true)
  sessionStorage.clear()
  setViewportWidth(DESKTOP_WIDTH)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  // Popular рендерит Header (десктоп) или MobileHeader (мобильный) — оба содержат ThemeToggle,
  // который выставляет data-theme на document.documentElement; jsdom document общий между
  // тестами файла, сбрасываем, чтобы тема не утекала в следующий тест (см. Header.test.tsx).
  document.documentElement.removeAttribute('data-theme')
})

describe('Popular — навигационный chrome (временное useViewport-ветвление)', () => {
  // "Popular" — общее название пункта навигации и в Header, и в BottomNav (в отличие от
  // Favorites, где Header называет пункт "Favorites", а BottomNav — "Lists"), поэтому им нельзя
  // отличить один chrome от другого. Используем пункты, уникальные для каждого варианта:
  // "Favorites" есть только в Header.navItems, "Lists" — только в BottomNav.items.
  it('на десктопной ширине рендерит Header, а не BottomNav', async () => {
    setViewportWidth(DESKTOP_WIDTH)
    server.use(http.get(LIST_ENDPOINT, () => successResponse([])))
    await renderPage()

    expect(
      screen.getByRole('button', { name: 'Favorites' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Lists' }),
    ).not.toBeInTheDocument()
  })

  it('на мобильной ширине рендерит MobileHeader+BottomNav, а не Header', async () => {
    setViewportWidth(MOBILE_WIDTH)
    server.use(http.get(LIST_ENDPOINT, () => successResponse([])))
    await renderPage()

    expect(screen.getByRole('button', { name: 'Lists' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Favorites' }),
    ).not.toBeInTheDocument()
  })
})

describe('Popular — успешная загрузка', () => {
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

  it('на мобильной ширине карточка тоже рендерит rank-бейдж', async () => {
    setViewportWidth(MOBILE_WIDTH)
    server.use(
      http.get(LIST_ENDPOINT, () =>
        successResponse([
          listItem({ movie: movieDoc({ id: 1, name: 'First Popular' }) }),
        ]),
      ),
    )

    await renderPage()

    expect(await screen.findByText('First Popular')).toBeInTheDocument()
    expect(screen.getByText('#1')).toBeInTheDocument()
  })
})

describe('Popular — пустой список', () => {
  it('пустой docs[] рендерит EmptyState, а не пустой грид', async () => {
    server.use(http.get(LIST_ENDPOINT, () => successResponse([])))

    await renderPage()

    expect(
      await screen.findByText('No popular movies right now'),
    ).toBeInTheDocument()
  })
})

describe('Popular — полный отказ загрузки', () => {
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
