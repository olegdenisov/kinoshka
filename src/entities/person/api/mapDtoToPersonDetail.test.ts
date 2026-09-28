import type { Person } from '@shared/api'

import { mapDtoToPersonDetail } from './mapDtoToPersonDetail'

const doc = (overrides: Partial<Person> = {}): Person => ({
  id: 1,
  name: 'Liv Korhonen',
  enName: 'Liv Korhonen',
  photo: 'https://example.com/liv.jpg',
  sex: 'female',
  growth: 170,
  birthday: '1990-03-14',
  death: null,
  age: 34,
  birthPlace: [{ value: 'Helsinki' }],
  deathPlace: [],
  spouses: [],
  countAwards: 3,
  profession: [{ value: 'actor' }, { value: 'producer' }],
  facts: [{ value: 'Started acting at age 5.' }],
  movies: [
    {
      id: 10,
      name: 'Orbit of Silence',
      rating: 8.1,
      description: 'Ines Varga',
      enProfession: 'actor',
    },
  ],
  updatedAt: '2024-01-01',
  createdAt: '2024-01-01',
  ...overrides,
})

describe('mapDtoToPersonDetail — полностью заполненный dto', () => {
  it('маппит все поля в PersonDetail', () => {
    expect(mapDtoToPersonDetail(doc())).toEqual({
      id: 1,
      name: 'Liv Korhonen',
      enName: undefined,
      photo: 'https://example.com/liv.jpg',
      birthday: '1990-03-14',
      death: undefined,
      age: 34,
      growth: 170,
      birthPlace: ['Helsinki'],
      deathPlace: [],
      countAwards: 3,
      professions: ['actor', 'producer'],
      facts: ['Started acting at age 5.'],
      movies: [
        {
          id: 10,
          title: 'Orbit of Silence',
          rating: 8.1,
          role: 'Ines Varga',
          profession: 'actor',
        },
      ],
    })
  })
})

describe('mapDtoToPersonDetail — пустой dto', () => {
  it('только id/updatedAt/createdAt — все опциональные поля становятся undefined/[]', () => {
    expect(
      mapDtoToPersonDetail({
        id: 42,
        updatedAt: '2024-01-01',
        createdAt: '2024-01-01',
      }),
    ).toEqual({
      id: 42,
      name: '',
      enName: undefined,
      photo: undefined,
      birthday: undefined,
      death: undefined,
      age: undefined,
      growth: undefined,
      birthPlace: [],
      deathPlace: [],
      countAwards: undefined,
      professions: [],
      facts: [],
      movies: [],
    })
  })
})

describe('mapDtoToPersonDetail — fallback имени name ?? enName', () => {
  it('name отсутствует — используется enName', () => {
    expect(
      mapDtoToPersonDetail(doc({ name: null, enName: 'Liv Korhonen EN' })).name,
    ).toBe('Liv Korhonen EN')
  })

  it('name и enName отсутствуют — пустая строка', () => {
    expect(mapDtoToPersonDetail(doc({ name: null, enName: null })).name).toBe(
      '',
    )
  })

  it('enName совпадает с name — не дублируется в результате', () => {
    expect(
      mapDtoToPersonDetail(
        doc({ name: 'Liv Korhonen', enName: 'Liv Korhonen' }),
      ).enName,
    ).toBeUndefined()
  })

  it('enName отличается от name — попадает в результат', () => {
    expect(
      mapDtoToPersonDetail(
        doc({ name: 'Liv Korhonen', enName: 'Лив Корхонен' }),
      ).enName,
    ).toBe('Лив Корхонен')
  })
})

describe('mapDtoToPersonDetail — profession[] дедупликация', () => {
  it('дубли в profession[] схлопываются', () => {
    expect(
      mapDtoToPersonDetail(
        doc({
          profession: [
            { value: 'actor' },
            { value: 'actor' },
            { value: 'producer' },
          ],
        }),
      ).professions,
    ).toEqual(['actor', 'producer'])
  })
})

describe('mapDtoToPersonDetail — movies[] fallback названия и фильтрация', () => {
  it('name отсутствует — используется alternativeName', () => {
    const result = mapDtoToPersonDetail(
      doc({
        movies: [{ id: 20, name: null, alternativeName: 'Alt Title' }],
      }),
    )

    expect(result.movies).toEqual([{ id: 20, title: 'Alt Title' }])
  })

  it('name и alternativeName отсутствуют — запись отбрасывается', () => {
    const result = mapDtoToPersonDetail(
      doc({
        movies: [{ id: 20, name: null, alternativeName: null }],
      }),
    )

    expect(result.movies).toEqual([])
  })
})

describe('mapDtoToPersonDetail — facts[] очистка от HTML-тегов', () => {
  it('тег вырезан, остаётся только текст', () => {
    expect(
      mapDtoToPersonDetail(
        doc({ facts: [{ value: '<span class="x">факт</span>' }] }),
      ).facts,
    ).toEqual(['факт'])
  })

  it('факт, состоящий только из тегов, отбрасывается целиком', () => {
    expect(
      mapDtoToPersonDetail(
        doc({ facts: [{ value: '<span class="x"></span>' }] }),
      ).facts,
    ).toEqual([])
  })
})
