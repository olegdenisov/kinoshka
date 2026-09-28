import type { PersonDetail } from '@entities/person'
import { render, screen } from '@testing-library/react'

import { PersonHero } from './PersonHero'

const basePerson: PersonDetail = {
  id: 1,
  name: 'Anna Actress',
  enName: 'Anna Actress EN',
  photo: 'https://avatars.mds.yandex.net/photo.jpg',
  birthday: '2024-03-14',
  death: '2024-04-20',
  age: 45,
  growth: 178,
  birthPlace: ['Moscow', 'Russia'],
  deathPlace: ['Los Angeles', 'USA'],
  countAwards: 3,
  professions: ['actor', 'producer'],
  facts: [],
  movies: [],
}

describe('PersonHero — полный набор данных', () => {
  it('показывает имя (h1), enName, все профессии и все мета-строки, включая Died in', () => {
    render(<PersonHero person={basePerson} />)

    expect(
      screen.getByRole('heading', { level: 1, name: 'Anna Actress' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Anna Actress EN')).toBeInTheDocument()
    expect(screen.getByText('actor')).toBeInTheDocument()
    expect(screen.getByText('producer')).toBeInTheDocument()

    expect(screen.getByText('Born')).toBeInTheDocument()
    expect(screen.getByText('March 14, 2024')).toBeInTheDocument()
    expect(screen.getByText('Died')).toBeInTheDocument()
    expect(screen.getByText('April 20, 2024')).toBeInTheDocument()
    expect(screen.getByText('Age')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('Height')).toBeInTheDocument()
    expect(screen.getByText('178 cm')).toBeInTheDocument()
    expect(screen.getByText('Born in')).toBeInTheDocument()
    expect(screen.getByText('Moscow, Russia')).toBeInTheDocument()
    expect(screen.getByText('Died in')).toBeInTheDocument()
    expect(screen.getByText('Los Angeles, USA')).toBeInTheDocument()
    expect(screen.getByText('Awards')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('PersonHero — без фото', () => {
  it('рендерит градиент-заглушку, а не <img> с пустым src', () => {
    render(<PersonHero person={{ ...basePerson, photo: undefined }} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('PersonHero — частично заполненные данные', () => {
  it('без death/growth/countAwards/birthPlace — соответствующие строки отсутствуют', () => {
    const partialPerson: PersonDetail = {
      ...basePerson,
      death: undefined,
      growth: undefined,
      countAwards: undefined,
      birthPlace: [],
      deathPlace: [],
    }

    render(<PersonHero person={partialPerson} />)

    expect(screen.queryByText('Died')).not.toBeInTheDocument()
    expect(screen.queryByText('Died in')).not.toBeInTheDocument()
    expect(screen.queryByText('Height')).not.toBeInTheDocument()
    expect(screen.queryByText('Awards')).not.toBeInTheDocument()
    expect(screen.queryByText('Born in')).not.toBeInTheDocument()

    // Живая персона: остальные строки, не зависящие от отброшенных полей, видны как обычно.
    expect(screen.getByText('Born')).toBeInTheDocument()
    expect(screen.getByText('Age')).toBeInTheDocument()
  })
})

describe('PersonHero — форматирование даты дефолтной локалью', () => {
  it('formatDate без явного locale рендерит en-US формат jsdom', () => {
    render(<PersonHero person={{ ...basePerson, death: undefined }} />)

    expect(screen.getByText('March 14, 2024')).toBeInTheDocument()
  })
})
