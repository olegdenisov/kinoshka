import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Routes, Route } from 'react-router'

import type { Movie } from '../../model/types'
import { Card } from './index'

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

const renderCard = (
  movie: Movie,
  props?: {
    isFavorite?: boolean
    onToggleFavorite?: (id: number) => void
    rankBadge?: ReactNode
  },
) =>
  render(
    <MemoryRouter>
      <Card movie={movie} {...props} />
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

    expect(screen.getByRole('link', { name: baseMovie.title })).toHaveAttribute(
      'href',
      '/movie/1',
    )
  })

  it('ссылка не содержит вложенных <button> (валидный HTML, нет вложенного interactive-content)', () => {
    renderCard(baseMovie, { isFavorite: false, onToggleFavorite: vi.fn() })

    const link = screen.getByRole('link')

    expect(link.querySelectorAll('button')).toHaveLength(0)
  })

  it('клавиатурный Tab-порядок: заголовок-ссылка достижима раньше action-кнопок', async () => {
    const user = userEvent.setup()
    renderCard(baseMovie, { onToggleFavorite: vi.fn() })

    await user.tab()
    expect(screen.getByRole('link', { name: baseMovie.title })).toHaveFocus()

    await user.tab()
    expect(screen.getAllByRole('button')[0]).toHaveFocus()
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

  it('без onToggleFavorite сердечко не рендерится', () => {
    renderCard(baseMovie)

    expect(screen.queryByLabelText('Add to favorites')).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('Remove from favorites'),
    ).not.toBeInTheDocument()
  })

  it('с onToggleFavorite — клик по сердечку вызывает колбэк с movie.id', async () => {
    const user = userEvent.setup()
    const onToggleFavorite = vi.fn()

    renderCard(baseMovie, { onToggleFavorite })

    await user.click(screen.getByLabelText('Add to favorites'))

    expect(onToggleFavorite).toHaveBeenCalledWith(1)
  })

  it('isFavorite=true — сердечко рендерится в filled-состоянии (label "Remove from favorites")', () => {
    renderCard(baseMovie, { isFavorite: true, onToggleFavorite: vi.fn() })

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
              <Card movie={baseMovie} onToggleFavorite={onToggleFavorite} />
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

  it('без rankBadge узел бейджа не рендерится (regression-guard)', () => {
    renderCard(baseMovie)

    expect(screen.queryByText('#1')).not.toBeInTheDocument()
  })

  it('с rankBadge — узел рендерится в верхнем блоке, не в .actions', () => {
    renderCard(baseMovie, { rankBadge: <span>#1</span> })

    const badge = screen.getByText('#1')
    expect(badge).toBeInTheDocument()

    // .actions содержит только action-кнопки (Rate/Add/...); rankBadge
    // должен лежать вне этого контейнера — сгруппирован с ratingBadge сверху.
    const actionButtons = screen.getAllByRole('button')
    for (const btn of actionButtons) {
      expect(btn.contains(badge)).toBe(false)
    }
  })

  it('movie.genre = [] — .metaDot не рендерится, нет висящего разделителя', () => {
    renderCard({ ...baseMovie, genre: [] })

    expect(screen.queryByText('·')).not.toBeInTheDocument()
  })
})
