import { QueryBoundary } from '@shared/ui'
import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { useWatchlistMovies } from './useWatchlistMovies'
import { watchlistSlot } from './watchlistStorage'

const doc = (id: number, overrides: Record<string, unknown> = {}) => ({
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
  slogan: 'tagline',
  description: 'synopsis',
  ...overrides,
})

const mockMovie = (id: number, overrides: Record<string, unknown> = {}) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () => HttpResponse.json(doc(id, overrides))),
  )
}

const mockError = (id: number, status: number) => {
  server.use(
    http.get(`*/v1.5/movie/${id}`, () =>
      HttpResponse.json(
        { statusCode: status, message: 'err', error: 'err' },
        { status },
      ),
    ),
  )
}

const Probe = () => {
  const query = useWatchlistMovies()
  return (
    <QueryBoundary query={query}>
      {movies => (
        <ul>
          {movies.map(movie => (
            <li key={movie.id}>{movie.title}</li>
          ))}
        </ul>
      )}
    </QueryBoundary>
  )
}

beforeEach(() => localStorage.clear())

describe('useWatchlistMovies', () => {
  it('читает ids из useWatchlist и отдаёт фильмы и сериалы', async () => {
    watchlistSlot.set([701, 702])
    mockMovie(701, { name: 'Watchlist Movie' })
    mockMovie(702, { name: 'Watchlist Series', type: 'tv-series' })

    await act(async () => {
      render(<Probe />)
    })

    expect(screen.getByText('Watchlist Movie')).toBeInTheDocument()
    expect(screen.getByText('Watchlist Series')).toBeInTheDocument()
  })

  it('404 у одного id → он выпадает из списка', async () => {
    watchlistSlot.set([711, 712])
    mockMovie(711, { name: 'Alive' })
    mockMovie(712, { name: 'Dead' })
    mockError(712, 404)

    await act(async () => {
      render(<Probe />)
    })

    expect(screen.getByText('Alive')).toBeInTheDocument()
    expect(screen.queryByText('Dead')).not.toBeInTheDocument()
  })

  it('все id 404 → пустой список', async () => {
    watchlistSlot.set([721, 722])
    mockError(721, 404)
    mockError(722, 404)

    await act(async () => {
      render(<Probe />)
    })

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })

  it('5xx → ошибка уходит в QueryBoundary, список не рендерится', async () => {
    watchlistSlot.set([731])
    mockError(731, 500)

    await act(async () => {
      render(<Probe />)
    })

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(
      screen.getByRole('button', { name: /Попробовать снова/ }),
    ).toBeInTheDocument()
  })

  it('пустые ids → пустой список', async () => {
    await act(async () => {
      render(<Probe />)
    })

    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
  })
})
