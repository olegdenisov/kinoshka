import type { PersonDetail } from '@entities/person'

import s from './Person.module.css'

type PersonProps = {
  person: PersonDetail
}

// Заглушка на Задачу 5: наполнение (PersonHero/Filmography/PersonFacts) —
// задачи 6-9 плана docs/plans/20260916-person-detail-page.md.
export const Person = ({ person }: PersonProps) => {
  return (
    <div className={s.root}>
      <h1>{person.name}</h1>
    </div>
  )
}
