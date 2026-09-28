import type { PersonMovieCredit } from '@entities/person'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'

import { Filmography } from './Filmography'

const renderFilmography = (credits: PersonMovieCredit[]) =>
  render(
    <MemoryRouter>
      <Filmography credits={credits} />
    </MemoryRouter>,
  )

const makeCredits = (
  count: number,
  profession: string,
  startId: number,
): PersonMovieCredit[] =>
  Array.from({ length: count }, (_, i) => ({
    id: startId + i,
    title: `${profession} movie ${i + 1}`,
    profession,
  }))

const getGroup = (label: string) =>
  screen.getByRole('region', { name: new RegExp(`^${label}\\b`) })

describe('Filmography — строки кредитов', () => {
  it('заголовок секции — h2 Filmography', () => {
    renderFilmography(makeCredits(1, 'actor', 1))

    expect(
      screen.getByRole('heading', { level: 2, name: 'Filmography' }),
    ).toBeInTheDocument()
  })

  it('кредиты — ссылки на /movie/:id, рядом видны рейтинг и роль', () => {
    renderFilmography([
      {
        id: 301,
        title: 'The Matrix',
        rating: 8.53,
        role: 'Neo',
        profession: 'actor',
      },
      { id: 302, title: 'John Wick', profession: 'producer' },
    ])

    expect(screen.getByRole('link', { name: 'The Matrix' })).toHaveAttribute(
      'href',
      '/movie/301',
    )
    expect(screen.getByRole('link', { name: 'John Wick' })).toHaveAttribute(
      'href',
      '/movie/302',
    )
    expect(screen.getByText('8.5')).toBeInTheDocument()
    expect(screen.getByText('Neo')).toBeInTheDocument()
  })

  it('rating: 0 показывается как «0.0», а не скрывается', () => {
    renderFilmography([
      { id: 1, title: 'Unrated', rating: 0, profession: 'actor' },
    ])

    expect(screen.getByText('0.0')).toBeInTheDocument()
  })

  it('без rating — рейтинг не рендерится', () => {
    renderFilmography([{ id: 1, title: 'No rating', profession: 'actor' }])

    const item = screen.getByRole('listitem')
    expect(item).toHaveTextContent(/^No rating$/)
  })

  it('один фильм в двух профессиях — две строки в разных группах без конфликта ключей', () => {
    renderFilmography([
      { id: 7, title: 'Same Movie', profession: 'actor' },
      { id: 7, title: 'Same Movie', profession: 'producer' },
    ])

    expect(screen.getAllByRole('link', { name: 'Same Movie' })).toHaveLength(2)
    expect(
      within(getGroup('Actor')).getByRole('link', { name: 'Same Movie' }),
    ).toBeInTheDocument()
    expect(
      within(getGroup('Producer')).getByRole('link', { name: 'Same Movie' }),
    ).toBeInTheDocument()
  })
})

describe('Filmography — сворачивание групп', () => {
  it('группа из 12 кредитов — без кнопки разворота', () => {
    renderFilmography(makeCredits(12, 'actor', 1))

    expect(screen.getAllByRole('link')).toHaveLength(12)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('группа из >12 кредитов показывает 12 и кнопку с label группы', () => {
    renderFilmography(makeCredits(20, 'actor', 1))

    expect(screen.getAllByRole('link')).toHaveLength(12)
    const button = screen.getByRole('button', {
      name: 'Show all 20 actor credits',
    })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('клик разворачивает только свою группу, соседняя остаётся свёрнутой', async () => {
    const user = userEvent.setup()
    renderFilmography([
      ...makeCredits(15, 'actor', 1),
      ...makeCredits(14, 'producer', 100),
    ])

    await user.click(
      screen.getByRole('button', { name: 'Show all 15 actor credits' }),
    )

    expect(within(getGroup('Actor')).getAllByRole('link')).toHaveLength(15)
    expect(within(getGroup('Producer')).getAllByRole('link')).toHaveLength(12)
    expect(
      screen.getByRole('button', { name: 'Show all 14 producer credits' }),
    ).toHaveAttribute('aria-expanded', 'false')

    // Кнопка не исчезает, а переключается — фокус не теряется.
    const collapse = screen.getByRole('button', {
      name: 'Show fewer actor credits',
    })
    expect(collapse).toHaveAttribute('aria-expanded', 'true')

    await user.click(collapse)
    expect(within(getGroup('Actor')).getAllByRole('link')).toHaveLength(12)
  })

  it('две группы с одинаковым числом кредитов — у кнопок разные доступные имена (a11y-регрессия)', () => {
    renderFilmography([
      ...makeCredits(13, 'actor', 1),
      ...makeCredits(13, 'director', 100),
    ])

    const names = screen
      .getAllByRole('button')
      .map(b => b.getAttribute('aria-label') ?? b.textContent)
    expect(names).toEqual([
      'Show all 13 actor credits',
      'Show all 13 director credits',
    ])
    expect(new Set(names).size).toBe(2)
  })
})

describe('Filmography — пустой список', () => {
  it('рендерит EmptyState вместо пустой секции', () => {
    renderFilmography([])

    expect(
      screen.getByRole('heading', { level: 2, name: 'Filmography' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No filmography yet')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
