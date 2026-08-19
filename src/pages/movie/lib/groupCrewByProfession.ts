import type { CrewMember } from '@entities/movie'

export const groupCrewByProfession = (crew: CrewMember[]) => {
  const order: string[] = []
  const namesByProfession = new Map<string, string[]>()

  for (const c of crew) {
    if (!namesByProfession.has(c.profession)) {
      order.push(c.profession)
      namesByProfession.set(c.profession, [])
    }
    namesByProfession.get(c.profession)!.push(c.name)
  }

  return order.map(profession => ({
    profession,
    names: namesByProfession.get(profession)!.join(', '),
  }))
}
