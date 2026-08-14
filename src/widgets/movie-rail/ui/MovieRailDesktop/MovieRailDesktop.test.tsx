import type { Movie } from '@entities/movie'
import { render, screen } from '@testing-library/react'
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
