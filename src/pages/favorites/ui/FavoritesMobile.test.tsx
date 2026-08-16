import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

describe('FavoritesMobile — полный отказ загрузки (все id 404)', () => {
  it('показывает сообщение об ошибке загрузки, а не пустой грид', async () => {
    setFavorites([404, 405])
    mockMovieError(404, 404)
    mockMovieError(405, 404)

    await renderPage()

    expect(
      await screen.findByText("Couldn't load your favorites"),
    ).toBeInTheDocument()
    expect(screen.queryByText('No favorites yet')).not.toBeInTheDocument()
  })
})

describe('FavoritesMobile — снятие с избранного на самой странице', () => {
  it('клик по сердечку убирает карточку из грида, остальные остаются', async () => {
    const user = userEvent.setup()
    setFavorites([1, 2])
    mockMovie(1, { name: 'First Favorite' })
    mockMovie(2, { name: 'Second Favorite' })

    await renderPage()

    expect(await screen.findByText('First Favorite')).toBeInTheDocument()
    expect(screen.getByText('Second Favorite')).toBeInTheDocument()

    await act(async () => {
      await user.click(
        screen.getAllByRole('button', { name: 'Remove from favorites' })[0],
      )
    })

    expect(screen.queryByText('First Favorite')).not.toBeInTheDocument()
    expect(screen.getByText('Second Favorite')).toBeInTheDocument()
  })
})
