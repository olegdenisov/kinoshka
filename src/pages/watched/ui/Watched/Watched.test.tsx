import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { server } from '../../../../test/setup'
import { Watched } from './Watched'

const WATCHED_KEY = 'kinoshka:watched'
const setWatched = (ids: number[]) =>
  localStorage.setItem(WATCHED_KEY, JSON.stringify(ids))

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
        <Watched />
      </MemoryRouter>,
    )
  })
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('Watched — пустой список', () => {
  it('рендерит EmptyState без сетевых запросов', async () => {
    await renderPage()

    expect(screen.getByRole('heading', { name: 'Watched' })).toBeInTheDocument()
    expect(screen.getByText('No watched titles yet')).toBeInTheDocument()
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

describe('Watched — непустой список', () => {
  it('рендерит карточки фильма и сериала (type: tv-series)', async () => {
    setWatched([1, 2])
    mockMovie(1, { name: 'Watched Movie' })
    mockMovie(2, { name: 'Watched Series', type: 'tv-series' })

    await renderPage()

    expect(await screen.findByText('Watched Movie')).toBeInTheDocument()
    expect(screen.getByText('Watched Series')).toBeInTheDocument()
  })

  it('клик по сердечку карточки пишет id в избранное, а карточка остаётся', async () => {
    const user = userEvent.setup()
    setWatched([1])
    mockMovie(1, { name: 'Watched Movie' })

    await renderPage()
    await user.click(
      await screen.findByRole('button', { name: 'Add to favorites' }),
    )

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[1]')
    expect(screen.getByText('Watched Movie')).toBeInTheDocument()
  })
})

describe('Watched — частичный отказ (404)', () => {
  it('карточка для 404-фильма не рендерится, остальные рендерятся', async () => {
    setWatched([1, 404])
    mockMovie(1, { name: 'Still Here' })
    mockMovieError(404, 404)

    await renderPage()

    expect(await screen.findByText('Still Here')).toBeInTheDocument()
    expect(screen.queryByText('Movie 404')).not.toBeInTheDocument()
  })
})

describe('Watched — полный отказ загрузки', () => {
  it('все id 404 → сообщение «titles unavailable», а не пустой грид', async () => {
    setWatched([404, 405])
    mockMovieError(404, 404)
    mockMovieError(405, 404)

    await renderPage()

    expect(
      await screen.findByText('Watched titles unavailable'),
    ).toBeInTheDocument()
    expect(screen.queryByText('No watched titles yet')).not.toBeInTheDocument()
  })

  it('5xx → error-фолбэк AsyncBoundary с Retry, а не EmptyState', async () => {
    setWatched([500, 501])
    mockMovieError(500, 500)
    mockMovieError(501, 500)

    await renderPage()

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument()
    expect(
      screen.queryByText('Watched titles unavailable'),
    ).not.toBeInTheDocument()
  })
})
