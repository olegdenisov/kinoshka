import type { PersonDetail } from '@entities/person'

import s from './PersonFacts.module.css'

type PersonFactsProps = {
  facts: PersonDetail['facts']
}

// Секция фактов — обычный список <ul>/<li>, рендерится только если facts
// непусто (в отличие от фильмографии, у которой есть EmptyState).
// Теги уже вырезаны в мапере getPersonDetail, компонент получает чистый текст.
export const PersonFacts = ({ facts }: PersonFactsProps) => {
  if (facts.length === 0) {
    return null
  }

  return (
    <section className={s.root}>
      <h2 className={s.heading}>Facts</h2>
      <ul className={s.list}>
        {/* Список статичен на весь маунт (родитель ремонтит по key={id}) — индекс как key безопасен. */}
        {facts.map((fact, index) => (
          <li key={index} className={s.item}>
            {fact}
          </li>
        ))}
      </ul>
    </section>
  )
}
