import type { Movie } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { RelatedMovies } from './RelatedMovies'

const makeMovie = (id: number): Movie => ({
  id,
  title: `Movie ${id}`,
  poster: `https://example.com/poster-${id}.jpg`,
  year: 2024,
  rating: 7.5,
  genre: ['Sci-Fi'],
  runtime: '120 min',
  hue: 20,
  type: 'movie',
})

const renderRelated = (movies: Movie[]) =>
  render(
    <MemoryRouter>
      <RelatedMovies movies={movies} movieTitle='Some Movie' />
    </MemoryRouter>,
  )

beforeEach(() => localStorage.clear())

describe('RelatedMovies — избранное', () => {
  it('карточка получает isFavorite/onToggleFavorite: клик по сердечку пишет id в localStorage', async () => {
    const user = userEvent.setup()
    renderRelated([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[1]')
    expect(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    ).toBeInTheDocument()
  })

  it('повторный клик снимает фильм из избранного', async () => {
    const user = userEvent.setup()
    renderRelated([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))
    await user.click(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    )

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[]')
    expect(
      screen.getByRole('button', { name: 'Add to favorites' }),
    ).toBeInTheDocument()
  })
})
