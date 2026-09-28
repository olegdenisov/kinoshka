import type { PersonDetail } from '@entities/person'

import { Filmography } from '../Filmography'
import { PersonFacts } from '../PersonFacts'
import { PersonHero } from '../PersonHero'

import s from './Person.module.css'

type PersonProps = {
  person: PersonDetail
}

// Три содержательных блока (герой, фильмография, факты) достаточно компактны,
// чтобы вмещаться в один скролл без табов. В отличие от /movie/:id, где табы
// нужны для четырёх больших панелей, здесь нет таб-специфичного состояния для
// сброса — просто скроллируемая страница с секциями. Копировать MovieTabsNav
// ради симметрии было бы карго-культом. Ремаунт при смене персоны всё же нужен
// (локальный useState в CreditGroup) — им управляет key={id} в PersonPage.
export const Person = ({ person }: PersonProps) => {
  return (
    <div className={s.root}>
      <PersonHero person={person} />
      <Filmography credits={person.movies} />
      <PersonFacts facts={person.facts} />
    </div>
  )
}
