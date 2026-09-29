import { AsyncBoundary } from '@shared/ui'
import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { useWatchedMovies } from './useWatchedMovies'
import { watchedSlot } from './watchedStorage'

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

const Probe = () => {
  const movies = useWatchedMovies()
  return (
    <ul>
      {movies.map(movie => (
        <li key={movie.id}>{movie.title}</li>
      ))}
    </ul>
  )
}

beforeEach(() => localStorage.clear())

describe('useWatchedMovies', () => {
  it('читает ids из useWatched и отдаёт фильмы и сериалы', async () => {
    watchedSlot.set([601, 602])
    mockMovie(601, { name: 'Watched Movie' })
    mockMovie(602, { name: 'Watched Series', type: 'tv-series' })

    await act(async () => {
      render(
        <AsyncBoundary>
          <Probe />
        </AsyncBoundary>,
      )
    })

    expect(screen.getByText('Watched Movie')).toBeInTheDocument()
    expect(screen.getByText('Watched Series')).toBeInTheDocument()
  })
})
