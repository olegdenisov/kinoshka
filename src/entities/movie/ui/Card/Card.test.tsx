import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { Card } from './index'
import type { Movie } from '../../model/types'

const baseMovie: Movie = {
  id: 1,
  title: 'Dune Part Two',
  rating: 8.4,
  type: 'movie',
  genre: ['Sci-Fi', 'Adventure'],
  runtime: '166 min',
  hue: 20,
  year: 2024,
}

const renderCard = (movie: Movie) =>
  render(
    <MemoryRouter>
      <Card movie={movie} />
    </MemoryRouter>,
  )

describe('Card', () => {
  it('рендерит год, когда movie.year задан', () => {
    renderCard(baseMovie)

    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  it('year fallback: movie.year отсутствует (undefined) — рендерит "Unknown", не крашится', () => {
    const withoutYear: Movie = { ...baseMovie }
    delete withoutYear.year

    renderCard(withoutYear)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })

  it('рендерит заголовок, рейтинг и первый жанр', () => {
    renderCard(baseMovie)

    expect(screen.getByText('8.4')).toBeInTheDocument()
    expect(screen.getByText('Sci-Fi')).toBeInTheDocument()
  })

  it('ссылается на /movie/:id', () => {
    renderCard(baseMovie)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/movie/1')
  })

  it('без реального постера — показывает fallback-плейсхолдер Poster (label)', () => {
    renderCard(baseMovie)

    // baseMovie.poster не задан → Poster рендерит "— poster —" + заголовок как fallback-label,
    // плюс заголовок ещё раз в Card.info — итого 2 вхождения.
    expect(screen.getByText('— poster —')).toBeInTheDocument()
    expect(screen.getAllByText('Dune Part Two')).toHaveLength(2)
  })

  it('с реальным постером — не показывает fallback-плейсхолдер Poster (label)', () => {
    renderCard({ ...baseMovie, poster: 'https://example.com/poster.jpg' })

    // Реальный постер есть → showLabel=false, "— poster —" и повторный заголовок-label не рендерятся.
    expect(screen.queryByText('— poster —')).not.toBeInTheDocument()
    expect(screen.getAllByText('Dune Part Two')).toHaveLength(1)
  })
})
