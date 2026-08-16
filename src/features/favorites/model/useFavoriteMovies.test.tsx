import { AsyncBoundary } from '@shared/ui'
import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'

import { server } from '../../../test/setup'
import { favoritesSlot } from './favoritesStorage'
import { useFavoriteMovies } from './useFavoriteMovies'

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
  const movies = useFavoriteMovies()
  return (
    <ul>
      {movies.map(movie => (
        <li key={movie.id}>{movie.title}</li>
      ))}
    </ul>
  )
}

beforeEach(() => localStorage.clear())

describe('useFavoriteMovies', () => {
  it('читает ids из useFavorites и отдаёт соответствующие Movie', async () => {
    favoritesSlot.set([501, 502])
    mockMovie(501, { name: 'First Favorite' })
    mockMovie(502, { name: 'Second Favorite' })

    await act(async () => {
      render(
        <AsyncBoundary>
          <Probe />
        </AsyncBoundary>,
      )
    })

    expect(screen.getByText('First Favorite')).toBeInTheDocument()
    expect(screen.getByText('Second Favorite')).toBeInTheDocument()
  })
})
