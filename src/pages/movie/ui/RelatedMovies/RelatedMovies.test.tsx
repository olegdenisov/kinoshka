import type { Movie } from '@entities/movie'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { readPersisted } from '../../../../test/persist'
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

    expect(readPersisted('kinoshka:favorites')).toEqual([1])
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

    expect(readPersisted('kinoshka:favorites')).toEqual([])
    expect(
      screen.getByRole('button', { name: 'Add to favorites' }),
    ).toBeInTheDocument()
  })
})

describe('RelatedMovies — Watchlist', () => {
  it('клик по кнопке Add карточки пишет id в watchlist и не трогает избранное', async () => {
    const user = userEvent.setup()
    renderRelated([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to watchlist' }))

    expect(localStorage.getItem('kinoshka:watchlist')).toBe('[1]')
    expect(readPersisted('kinoshka:favorites')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Remove from watchlist' }),
    ).toBeInTheDocument()
  })

  it('повторный клик снимает фильм из watchlist', async () => {
    const user = userEvent.setup()
    renderRelated([makeMovie(1)])

    await user.click(screen.getByRole('button', { name: 'Add to watchlist' }))
    await user.click(
      screen.getByRole('button', { name: 'Remove from watchlist' }),
    )

    expect(localStorage.getItem('kinoshka:watchlist')).toBe('[]')
  })
})

describe('RelatedMovies — lazy-mount', () => {
  const original = window.IntersectionObserver
  let fireIntersect: (() => void) | null = null

  beforeEach(() => {
    fireIntersect = null
    // Observer, который сам не сообщает о пересечении — секция «вне вьюпорта»; срабатывание
    // эмулируется вручную через fireIntersect().
    window.IntersectionObserver = class {
      private readonly callback: IntersectionObserverCallback
      constructor(callback: IntersectionObserverCallback) {
        this.callback = callback
      }
      observe(target: Element) {
        fireIntersect = () =>
          this.callback(
            [{ isIntersecting: true, target } as IntersectionObserverEntry],
            this as unknown as IntersectionObserver,
          )
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return []
      }
    } as unknown as typeof IntersectionObserver
  })

  afterEach(() => {
    window.IntersectionObserver = original
  })

  it('вне вьюпорта: заголовок виден, вместо Card — по плейсхолдеру на фильм', () => {
    const { container } = renderRelated([makeMovie(1), makeMovie(2)])

    expect(screen.getByText('More like Some Movie')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: /favorites/ })).toHaveLength(
      0,
    )
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2)
  })

  it('после пересечения плейсхолдеры заменяются карточками', () => {
    const { container } = renderRelated([makeMovie(1), makeMovie(2)])

    act(() => fireIntersect?.())

    expect(
      screen.getAllByRole('button', { name: 'Add to favorites' }),
    ).toHaveLength(2)
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(0)
  })
})

describe('RelatedMovies — пустой список', () => {
  it('movies=[] — секция не рендерится', () => {
    const { container } = renderRelated([])

    expect(container).toBeEmptyDOMElement()
  })
})
