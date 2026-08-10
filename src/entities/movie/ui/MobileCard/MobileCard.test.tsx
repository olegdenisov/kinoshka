import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import type { Movie } from '../../model/types'
import { MobileCard } from './index'

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

const renderMobileCard = (movie: Movie) =>
  render(
    <MemoryRouter>
      <MobileCard movie={movie} />
    </MemoryRouter>,
  )

describe('MobileCard', () => {
  it('рендерит год, когда movie.year задан', () => {
    renderMobileCard(baseMovie)

    expect(screen.getByText('2024')).toBeInTheDocument()
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument()
  })

  it('year fallback: movie.year отсутствует (undefined) — рендерит "Unknown", не крашится', () => {
    const withoutYear: Movie = { ...baseMovie }
    delete withoutYear.year

    renderMobileCard(withoutYear)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
