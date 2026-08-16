import type { Movie } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { MovieRailDesktop } from './MovieRailDesktop'

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

const renderRail = (items: Movie[]) =>
  render(
    <MemoryRouter>
      <MovieRailDesktop title='Popular' subtitle='Trending' items={items} />
    </MemoryRouter>,
  )

beforeEach(() => localStorage.clear())

describe('MovieRailDesktop', () => {
  it('items=[] → рендерится EmptyState, карточки отсутствуют', () => {
    renderRail([])

    expect(screen.getByText('В подборке пока пусто')).toBeInTheDocument()
    expect(
      screen.getByText('Нет фильмов в разделе «Popular»'),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('link', { name: /Movie \d/ })).toHaveLength(0)
  })

  it('заголовок секции (ссылка на /search) остаётся видимым при пустых items', () => {
    renderRail([])

    expect(screen.getByRole('link', { name: /Popular/ })).toHaveAttribute(
      'href',
      '/search',
    )
  })

  it('items непустой → рендерятся карточки, EmptyState отсутствует', () => {
    renderRail([makeMovie(1), makeMovie(2)])

    expect(screen.getByText('Movie 1')).toBeInTheDocument()
    expect(screen.getByText('Movie 2')).toBeInTheDocument()
    expect(screen.queryByText('В подборке пока пусто')).not.toBeInTheDocument()
  })
})

describe('MovieRailDesktop — избранное', () => {
  it('клик по сердечку карточки пишет id фильма в localStorage', async () => {
    const user = userEvent.setup()
    renderRail([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[1]')
  })

  it('повторный клик по уже избранной карточке снимает избранное (toggle туда-обратно)', async () => {
    const user = userEvent.setup()
    renderRail([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to favorites' }))
    expect(localStorage.getItem('kinoshka:favorites')).toBe('[1]')

    await user.click(
      screen.getByRole('button', { name: 'Remove from favorites' }),
    )

    expect(localStorage.getItem('kinoshka:favorites')).toBe('[]')
  })
})
