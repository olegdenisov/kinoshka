import type { CrewMember } from '@entities/movie'

import { groupCrewByProfession } from './groupCrewByProfession'

describe('groupCrewByProfession', () => {
  it('пустой crew — пустой результат', () => {
    expect(groupCrewByProfession([])).toEqual([])
  })

  it('несколько человек одной профессии — один элемент со списком members', () => {
    const crew: CrewMember[] = [
      { id: 1, name: 'Алиса', profession: 'Сценарист' },
      { id: 2, name: 'Борис', profession: 'Сценарист' },
    ]

    expect(groupCrewByProfession(crew)).toEqual([
      {
        profession: 'Сценарист',
        members: [
          { id: 1, name: 'Алиса', profession: 'Сценарист' },
          { id: 2, name: 'Борис', profession: 'Сценарист' },
        ],
      },
    ])
  })

  it('порядок профессий — по первому появлению', () => {
    const crew: CrewMember[] = [
      { id: 1, name: 'Алиса', profession: 'Продюсер' },
      { id: 2, name: 'Борис', profession: 'Режиссёр' },
      { id: 3, name: 'Вера', profession: 'Продюсер' },
    ]

    expect(groupCrewByProfession(crew).map(g => g.profession)).toEqual([
      'Продюсер',
      'Режиссёр',
    ])
  })

  it('порядок members внутри профессии — по появлению в исходном crew', () => {
    const crew: CrewMember[] = [
      { id: 1, name: 'Алиса', profession: 'Продюсер' },
      { id: 2, name: 'Борис', profession: 'Режиссёр' },
      { id: 3, name: 'Вера', profession: 'Продюсер' },
    ]

    expect(
      groupCrewByProfession(crew).find(g => g.profession === 'Продюсер')
        ?.members,
    ).toEqual([
      { id: 1, name: 'Алиса', profession: 'Продюсер' },
      { id: 3, name: 'Вера', profession: 'Продюсер' },
    ])
  })

  it('один человек с несколькими профессиями (одинаковый id) — отдельная группа на каждую профессию', () => {
    const crew: CrewMember[] = [
      { id: 1, name: 'Алиса', profession: 'Режиссёр' },
      { id: 1, name: 'Алиса', profession: 'Сценарист' },
    ]

    expect(groupCrewByProfession(crew)).toEqual([
      {
        profession: 'Режиссёр',
        members: [{ id: 1, name: 'Алиса', profession: 'Режиссёр' }],
      },
      {
        profession: 'Сценарист',
        members: [{ id: 1, name: 'Алиса', profession: 'Сценарист' }],
      },
    ])
  })

  it('дубль одной персоны в одной профессии — обе записи сохраняются в members', () => {
    const crew: CrewMember[] = [
      { id: 1, name: 'Алиса', profession: 'Продюсер' },
      { id: 1, name: 'Алиса', profession: 'Продюсер' },
    ]

    expect(groupCrewByProfession(crew)).toEqual([
      {
        profession: 'Продюсер',
        members: [
          { id: 1, name: 'Алиса', profession: 'Продюсер' },
          { id: 1, name: 'Алиса', profession: 'Продюсер' },
        ],
      },
    ])
  })
})
