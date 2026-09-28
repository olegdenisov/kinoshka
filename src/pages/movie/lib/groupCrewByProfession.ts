import type { CrewMember } from '@entities/movie'

export const groupCrewByProfession = (crew: CrewMember[]) => {
  const order: string[] = []
  const membersByProfession = new Map<string, CrewMember[]>()

  for (const c of crew) {
    if (!membersByProfession.has(c.profession)) {
      order.push(c.profession)
      membersByProfession.set(c.profession, [])
    }
    membersByProfession.get(c.profession)!.push(c)
  }

  // Возвращаем сами CrewMember, а не склеенную строку имён: из строки не построить
  // ссылку <Link to={`/person/${id}`}> на каждого члена группы (Задача 12) — id теряется
  // при join(', ').
  return order.map(profession => ({
    profession,
    members: membersByProfession.get(profession)!,
  }))
}
