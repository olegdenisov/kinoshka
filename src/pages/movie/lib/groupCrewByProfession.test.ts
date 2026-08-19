import type { CrewMember } from '@entities/movie'

import { groupCrewByProfession } from './groupCrewByProfession'

describe('groupCrewByProfession', () => {
  it('пустой crew — пустой результат', () => {
    expect(groupCrewByProfession([])).toEqual([])
  })

  it('несколько человек одной профессии — одна строка со списком имён', () => {
    const crew: CrewMember[] = [
      { id: 1, name: 'Алиса', profession: 'Сценарист' },
      { id: 2, name: 'Борис', profession: 'Сценарист' },
    ]

    expect(groupCrewByProfession(crew)).toEqual([
      { profession: 'Сценарист', names: 'Алиса, Борис' },
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

  it('один человек с несколькими профессиями (одинаковый id) — отдельная строка на каждую профессию', () => {
    const crew: CrewMember[] = [
      { id: 1, name: 'Алиса', profession: 'Режиссёр' },
      { id: 1, name: 'Алиса', profession: 'Сценарист' },
    ]

    expect(groupCrewByProfession(crew)).toEqual([
      { profession: 'Режиссёр', names: 'Алиса' },
      { profession: 'Сценарист', names: 'Алиса' },
    ])
  })
})
