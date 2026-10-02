import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { seedStorage } from '../../../../test/seedStorage'
import { server } from '../../../../test/setup'
import { Watchlist } from './Watchlist'

const WATCHLIST_KEY = 'kinoshka:watchlist'
const setWatchlist = (ids: number[]) =>
  seedStorage(WATCHLIST_KEY, JSON.stringify(ids))

const movieDoc = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Movie ${id}`,
  year: 2024,
  type: 'movie',
  rating: { kp: 8.1, imdb: 7.9 },
  genres: [{ name: 'drama' }],
  movieLength: 120,
  poster: { previewUrl: 'https://example.com/poster.jpg' },
  persons: [],
  countries: [],
  ...overrides,
})

const mockMovie = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(movieDoc(id, overrides)),
    ),
  )
}

const mockMovieError = (id: number, status: number) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(
        { statusCode: status, message: 'error', error: 'error' },
        { status },
      ),
    ),
  )
}

const renderPage = async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <Watchlist />
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('Watchlist — пустой список', () => {
  it('рендерит EmptyState без сетевых запросов', async () => {
    await renderPage()

    expect(
      screen.getByRole('heading', { name: 'Watchlist' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Nothing in your watchlist yet'),
    ).toBeInTheDocument()
  })

  it('не делает запросов за фильмами', async () => {
    const requested = vi.fn()
    server.use(
      http.get('*/v1.5/movie/*', () => {
        requested()
        return HttpResponse.json(movieDoc(1))
      }),
    )

    await renderPage()

    expect(requested).not.toHaveBeenCalled()
  })
})

describe('Watchlist — непустой список', () => {
  it('рендерит карточки фильма и сериала (type: tv-series)', async () => {
    setWatchlist([1, 2])
    mockMovie(1, { name: 'Watchlist Movie' })
    mockMovie(2, { name: 'Watchlist Series', type: 'tv-series' })

    await renderPage()

    expect(await screen.findByText('Watchlist Movie')).toBeInTheDocument()
    expect(screen.getByText('Watchlist Series')).toBeInTheDocument()
  })

  it('клик по сердечку карточки пишет id в избранное, а карточка остаётся', async () => {
    const user = userEvent.setup()
    setWatchlist([1])
    mockMovie(1, { name: 'Watchlist Movie' })

    await renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Add to favorites' }),
    )

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[1]')
    expect(screen.getByText('Watchlist Movie')).toBeInTheDocument()
  })
})

describe('Watchlist — независимость от Watched', () => {
  it('тайтл, одновременно лежащий в watched и watchlist, отображается на странице', async () => {
    seedStorage('kinoshka:watched', JSON.stringify([1]))
    setWatchlist([1])
    mockMovie(1, { name: 'Both Lists' })

    await renderPage()

    expect(await screen.findByText('Both Lists')).toBeInTheDocument()
    // Страница не трогает watched: ключ остаётся как был.
    expect(localStorage.getItem('kinoshka:watched')).toBe('[1]')
    expect(localStorage.getItem(WATCHLIST_KEY)).toBe('[1]')
  })
})

describe('Watchlist — частичный отказ (404)', () => {
  it('карточка для 404-фильма не рендерится, остальные рендерятся', async () => {
    setWatchlist([1, 404])
    mockMovie(1, { name: 'Still Here' })
    // Имя в моке 404-фильма — то, которое отрисовала бы карточка, если бы фильтр не сработал.
    mockMovie(404, { name: 'Gone Movie' })
    mockMovieError(404, 404)

    await renderPage()

    expect(await screen.findByText('Still Here')).toBeInTheDocument()
    expect(screen.queryByText('Gone Movie')).not.toBeInTheDocument()
  })
})

describe('Watchlist — полный отказ загрузки', () => {
  it('все id 404 → сообщение «titles unavailable», а не пустой грид', async () => {
    setWatchlist([404, 405])
    mockMovieError(404, 404)
    mockMovieError(405, 404)

    await renderPage()

    expect(
      await screen.findByText('Watchlist titles unavailable'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Nothing in your watchlist yet'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Попробовать снова/ }),
    ).not.toBeInTheDocument()
  })

  it('5xx → error-фолбэк AsyncBoundary с Retry, а не EmptyState', async () => {
    setWatchlist([500, 501])
    mockMovieError(500, 500)
    mockMovieError(501, 500)

    await renderPage()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Попробовать снова/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Watchlist titles unavailable'),
    ).not.toBeInTheDocument()
  })
})
