import type { PersonDetail } from '@entities/person'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { Person } from './Person'

const mockPerson = (overrides: Partial<PersonDetail> = {}): PersonDetail => ({
  id: 1,
  name: 'John Actor',
  enName: 'John Actor EN',
  photo: 'https://avatars.mds.yandex.net/photo.jpg',
  birthday: '1980-01-01',
  death: undefined,
  age: 44,
  growth: 180,
  birthPlace: ['Moscow'],
  deathPlace: [],
  countAwards: 5,
  professions: ['Actor'],
  facts: ['Fact 1', 'Fact 2'],
  movies: [
    {
      id: 100,
      title: 'Movie 1',
      rating: 8.5,
      role: 'Main character',
      profession: 'actor',
    },
    {
      id: 101,
      title: 'Movie 2',
      rating: 7.0,
      role: 'Supporting',
      profession: 'actor',
    },
  ],
  ...overrides,
})

// Помощник для рендера с MemoryRouter, т.к. Filmography содержит <Link>
const renderPerson = (person: PersonDetail) => {
  return render(
    <MemoryRouter>
      <Person person={person} />
    </MemoryRouter>,
  )
}

describe('Person — композиция компонентов', () => {
  it('полная персона → присутствуют имя, секция Filmography и секция Facts', () => {
    const person = mockPerson()
    renderPerson(person)

    // Имя из PersonHero (находится в h1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'John Actor',
    )

    // Filmography: заголовок h2 и ссылки на фильмы
    expect(
      screen.getByRole('heading', { level: 2, name: 'Filmography' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Movie 1/ })).toBeInTheDocument()

    // Facts: заголовок h2 и пункты списка
    expect(
      screen.getByRole('heading', { level: 2, name: 'Facts' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Fact 1')).toBeInTheDocument()
    expect(screen.getByText('Fact 2')).toBeInTheDocument()
  })

  it('персона без фактов и без фильмографии → имя есть, Facts нет, Filmography показывает EmptyState', () => {
    const person = mockPerson({
      movies: [],
      facts: [],
    })
    renderPerson(person)

    // Имя из PersonHero
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'John Actor',
    )

    // Facts: секция не рендерится вовсе
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Facts' }),
    ).not.toBeInTheDocument()

    // Filmography: заголовок есть, но вместо списка — EmptyState
    expect(
      screen.getByRole('heading', { level: 2, name: 'Filmography' }),
    ).toBeInTheDocument()
    expect(screen.getByText('No filmography yet')).toBeInTheDocument()
    expect(
      screen.getByText('There are no credits for this person.'),
    ).toBeInTheDocument()
  })
})
