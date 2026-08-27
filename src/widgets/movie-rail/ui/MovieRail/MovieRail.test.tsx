import type { Movie, PopularMovie } from '@entities/movie'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { MovieRail } from './MovieRail'

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

const makePopularMovie = (id: number, position: number): PopularMovie => ({
  ...makeMovie(id),
  position,
  positionDiff: null,
})

const renderRail = (items: (Movie | PopularMovie)[], href?: string) =>
  render(
    <MemoryRouter>
      <MovieRail
        title='Popular'
        subtitle='Trending'
        items={items}
        href={href}
      />
    </MemoryRouter>,
  )

beforeEach(() => localStorage.clear())

describe('MovieRail', () => {
  it('items=[] → рендерится EmptyState, карточки отсутствуют', () => {
    renderRail([])

    expect(screen.getByText('В подборке пока пусто')).toBeInTheDocument()
    expect(
      screen.getByText('Нет фильмов в разделе «Popular»'),
    ).toBeInTheDocument()
    expect(screen.queryAllByRole('link', { name: /Movie \d/ })).toHaveLength(0)
  })

  it('заголовок секции (ссылка на /search по умолчанию) остаётся видимым при пустых items', () => {
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

  it('каждая карточка обёрнута в .scrollItem (сохранённая обёртка бывшего MovieRailMobile)', () => {
    const { container } = renderRail([makeMovie(1), makeMovie(2)])

    const scrollItems = container.querySelectorAll('[class*="scrollItem"]')
    expect(scrollItems).toHaveLength(2)
  })
})

describe('MovieRail — избранное', () => {
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

describe('MovieRail — PopularMovie[] и rank-бейджи', () => {
  it('рейл с PopularMovie[] рендерит PopularBadge внутри карточек', () => {
    renderRail([makePopularMovie(1, 3), makePopularMovie(2, 7)])

    expect(screen.getByLabelText('Position 3')).toBeInTheDocument()
    expect(screen.getByLabelText('Position 7')).toBeInTheDocument()
  })

  it('рейл с обычным Movie[] не рендерит PopularBadge', () => {
    renderRail([makeMovie(1), makeMovie(2)])

    expect(screen.queryByLabelText(/^Position \d/)).not.toBeInTheDocument()
  })
})

describe('MovieRail — href заголовка', () => {
  it('с явным href="/popular" заголовок ведёт на /popular', () => {
    renderRail([makeMovie(1)], '/popular')

    expect(screen.getByRole('link', { name: /Popular/ })).toHaveAttribute(
      'href',
      '/popular',
    )
  })

  it('без href заголовок ведёт на /search (дефолт, как раньше хардкодил MovieRailMobile)', () => {
    renderRail([makeMovie(1)])

    expect(screen.getByRole('link', { name: /Popular/ })).toHaveAttribute(
      'href',
      '/search',
    )
  })
})

describe('MovieRail — карточки в рейле всегда variant="compact" (без Eye-кнопки)', () => {
  it('на один элемент рейла ровно 5 кнопок: избранное + Rate + Add + 2 стрелки скролла — Eye-кнопка (только variant="grid") отсутствует', () => {
    renderRail([makeMovie(1)])

    // Card default variant post-Task-2 is 'grid' (renders an extra unlabeled
    // Eye button) — MovieRail must pass variant='compact' explicitly so that
    // extra button never shows up in rails.
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })
})

describe('MovieRail — стрелки скролла', () => {
  it('кнопки Previous/Next присутствуют в DOM (видимость управляется CSS hover/pointer media, не JS)', () => {
    renderRail([makeMovie(1), makeMovie(2)])

    expect(screen.getByRole('button', { name: 'Previous' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument()
  })

  it('клик по стрелке вызывает scrollBy на контейнере скролла', async () => {
    const user = userEvent.setup()
    renderRail([makeMovie(1), makeMovie(2)])

    const scrollBySpy = vi.fn()
    HTMLDivElement.prototype.scrollBy = scrollBySpy

    await user.click(screen.getByRole('button', { name: 'Next' }))

    expect(scrollBySpy).toHaveBeenCalledWith({ left: 480, behavior: 'smooth' })

    await user.click(screen.getByRole('button', { name: 'Previous' }))

    expect(scrollBySpy).toHaveBeenCalledWith({ left: -480, behavior: 'smooth' })
  })
})
