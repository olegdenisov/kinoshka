import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router'

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

const renderMobileCard = (
  movie: Movie,
  props?: { isFavorite?: boolean; onToggleFavorite?: (id: number) => void },
) =>
  render(
    <MemoryRouter>
      <MobileCard movie={movie} {...props} />
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

  it('без onToggleFavorite сердечко не рендерится', () => {
    renderMobileCard(baseMovie)

    expect(screen.queryByLabelText('Add to favorites')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Remove from favorites'),
    ).not.toBeInTheDocument()
  })

  it('с onToggleFavorite — клик по сердечку вызывает колбэк с movie.id', async () => {
    const user = userEvent.setup()
    const onToggleFavorite = vi.fn()

    renderMobileCard(baseMovie, { onToggleFavorite })

    await user.click(screen.getByLabelText('Add to favorites'))

    expect(onToggleFavorite).toHaveBeenCalledWith(1)
  })

  it('isFavorite=true — сердечко рендерится в filled-состоянии (label "Remove from favorites")', () => {
    renderMobileCard(baseMovie, { isFavorite: true, onToggleFavorite: vi.fn() })

    expect(screen.getByLabelText('Remove from favorites')).toBeInTheDocument()
    expect(screen.queryByLabelText('Add to favorites')).not.toBeInTheDocument()
  })

  it('клик по сердечку не триггерит переход по Link (location не меняется)', async () => {
    const user = userEvent.setup()
    const onToggleFavorite = vi.fn()

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route
            path='/'
            element={
              <MobileCard
                movie={baseMovie}
                onToggleFavorite={onToggleFavorite}
              />
            }
          />
          <Route path='/movie/:id' element={<div>movie page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await user.click(screen.getByLabelText('Add to favorites'))

    expect(onToggleFavorite).toHaveBeenCalledWith(1)
    expect(screen.queryByText('movie page')).not.toBeInTheDocument()
  })
})
