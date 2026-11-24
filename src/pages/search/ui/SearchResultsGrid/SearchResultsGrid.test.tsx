import type { Movie } from '@entities/movie'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { readPersisted, seedPersisted } from '../../../../test/persist'
import { renderWithRouter } from '../../../../test/router'
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
  renderWithRouter(<SearchResultsGrid movies={movies} />)

beforeEach(() => localStorage.clear())

describe('SearchResultsGrid — избранное', () => {
  it('клик по сердечку карточки пишет id фильма в localStorage', async () => {
    const user = userEvent.setup()
    renderGrid([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))

    expect(readPersisted('kinoshka:favorites')).toEqual([1])
  })

  it('повторный клик по уже избранной карточке снимает избранное (toggle туда-обратно)', async () => {
    const user = userEvent.setup()
    renderGrid([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))
    expect(readPersisted('kinoshka:favorites')).toEqual([1])

    await user.click(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    )

    expect(readPersisted('kinoshka:favorites')).toEqual([])
  })
})

describe('SearchResultsGrid — Watchlist', () => {
  it('клик по кнопке Add карточки пишет id фильма в watchlist и не трогает избранное', async () => {
    const user = userEvent.setup()
    renderGrid([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to watchlist' }))

    expect(readPersisted('kinoshka:watchlist')).toEqual([1])
    expect(readPersisted('kinoshka:favorites')).toBeNull()
  })

  it('повторный клик снимает фильм из watchlist (toggle туда-обратно)', async () => {
    const user = userEvent.setup()
    renderGrid([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    await user.click(
      screen.getByRole('button', { name: 'Remove from watchlist' }),
    )

    expect(readPersisted('kinoshka:watchlist')).toEqual([])
  })

  it('фильм уже в watchlist — кнопка сразу в состоянии «Remove from watchlist»', () => {
    seedPersisted('kinoshka:watchlist', [1])
    renderGrid([makeMovie(1), makeMovie(2)])

    expect(
      screen.getAllByRole('button', { name: 'Remove from watchlist' }),
    ).toHaveLength(1)
    expect(
      screen.getAllByRole('button', { name: 'Add to watchlist' }),
    ).toHaveLength(1)
  })
})
