import type { PersonMovieCredit } from '@entities/person'

import { groupCreditsByProfession } from './groupCreditsByProfession'

const credit = (
  id: number,
  profession?: string,
  extra: Partial<PersonMovieCredit> = {},
): PersonMovieCredit => ({ id, title: `Movie ${id}`, profession, ...extra })

describe('groupCreditsByProfession', () => {
  it('пустой список — пустой результат', () => {
    expect(groupCreditsByProfession([])).toEqual([])
  })

  it('группы идут в предпочтительном порядке независимо от порядка в ответе API', () => {
    const credits = [
      credit(1, 'producer'),
      credit(2, 'operator'),
      credit(3, 'writer'),
      credit(4, 'actor'),
      credit(5, 'composer'),
      credit(6, 'director'),
    ]

    expect(groupCreditsByProfession(credits).map(g => g.profession)).toEqual([
      'actor',
      'director',
      'writer',
      'producer',
      'composer',
      'operator',
    ])
  })

  it('лейблы берутся из словаря', () => {
    const groups = groupCreditsByProfession([
      credit(1, 'actor'),
      credit(2, 'cameo'),
    ])

    expect(groups.map(g => g.label)).toEqual(['Actor', 'Cameo'])
  })

  it('неизвестная профессия попадает в конец с сырым лейблом, остальные — в порядке первого появления', () => {
    const groups = groupCreditsByProfession([
      credit(1, 'stunt_double'),
      credit(2, 'actor'),
      credit(3, 'cameo'),
      credit(4, 'stunt_double'),
    ])

    expect(groups.map(g => [g.profession, g.label])).toEqual([
      ['actor', 'Actor'],
      ['stunt_double', 'stunt_double'],
      ['cameo', 'Cameo'],
    ])
  })

  it('undefined профессия не роняет функцию — кредит попадает в группу Other', () => {
    const groups = groupCreditsByProfession([credit(1), credit(2, 'actor')])

    expect(groups).toEqual([
      { profession: 'actor', label: 'Actor', credits: [credit(2, 'actor')] },
      { profession: '', label: 'Other', credits: [credit(1)] },
    ])
  })

  it('порядок кредитов внутри группы сохраняется', () => {
    const groups = groupCreditsByProfession([
      credit(30, 'actor'),
      credit(10, 'director'),
      credit(20, 'actor'),
      credit(40, 'actor'),
    ])

    expect(groups[0].credits.map(c => c.id)).toEqual([30, 20, 40])
  })

  it('один фильм в двух профессиях — по кредиту в каждой группе', () => {
    const groups = groupCreditsByProfession([
      credit(1, 'actor'),
      credit(1, 'producer'),
    ])

    expect(groups.map(g => g.credits.map(c => c.id))).toEqual([[1], [1]])
  })
})
