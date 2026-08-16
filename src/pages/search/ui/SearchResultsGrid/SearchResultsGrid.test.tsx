import type { Movie } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { SearchResultsGrid } from './SearchResultsGrid'

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

const renderGrid = (movies: Movie[]) =>
  render(
    <MemoryRouter>
      <SearchResultsGrid movies={movies} />
    </MemoryRouter>,
  )

beforeEach(() => localStorage.clear())

describe('SearchResultsGrid — избранное', () => {
  it('клик по сердечку карточки пишет id фильма в localStorage', async () => {
    const user = userEvent.setup()
    renderGrid([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[1]')
  })

  it('повторный клик по уже избранной карточке снимает избранное (toggle туда-обратно)', async () => {
    const user = userEvent.setup()
    renderGrid([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))
    expect(localStorage.getItem('kinoshka:favorites')).toBe('[1]')

    await user.click(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    )

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[]')
  })
})
