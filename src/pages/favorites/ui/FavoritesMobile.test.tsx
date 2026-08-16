import { act, render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router'

import { server } from '../../../test/setup'
import { FavoritesMobile } from './FavoritesMobile'

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

const FAVORITES_KEY = 'kinoshka:favorites'
const setFavorites = (ids: number[]) =>
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids))

const renderPage = async () => {
  let result: ReturnType<typeof render> | undefined

  await act(async () => {
    result = render(
      <MemoryRouter>
        <FavoritesMobile />
      </MemoryRouter>,
    )
  })

  return result!
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

describe('FavoritesMobile — пустой список избранного', () => {
  it('рендерит EmptyState без сетевых запросов', async () => {
    await renderPage()

    expect(screen.getByText('No favorites yet')).toBeInTheDocument()
  })
})

describe('FavoritesMobile — непустой список избранного', () => {
  it('рендерит карточки с данными для каждого избранного фильма', async () => {
    setFavorites([1, 2])
    mockMovie(1, { name: 'First Favorite' })
    mockMovie(2, { name: 'Second Favorite' })

    await renderPage()

    expect(await screen.findByText('First Favorite')).toBeInTheDocument()
    expect(screen.getByText('Second Favorite')).toBeInTheDocument()
  })
})
