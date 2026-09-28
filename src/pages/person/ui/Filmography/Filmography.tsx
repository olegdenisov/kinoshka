import type { PersonMovieCredit } from '@entities/person'
import { EmptyState } from '@shared/ui'
import { useId } from 'react'

import { groupCreditsByProfession } from '../../lib/groupCreditsByProfession'
import { CreditGroup } from './CreditGroup'

import s from './Filmography.module.css'

type FilmographyProps = {
  credits: PersonMovieCredit[]
}

// Заголовок — настоящий <h2>, а не декоративный sectionHead-div, как во вкладках
// /movie/:id: там доступное имя панели даёт активная вкладка, а здесь страница —
// один скролл из нескольких секций, и <h1> из PersonHero нужна иерархия под ним.
export const Filmography = ({ credits }: FilmographyProps) => {
  const headingId = useId()
  const groups = groupCreditsByProfession(credits)

  return (
    <section className={s.root} aria-labelledby={headingId}>
      <h2 id={headingId} className={s.heading}>
        Filmography
      </h2>
      {groups.length === 0 ? (
        <EmptyState
          title='No filmography yet'
          description='There are no credits for this person.'
        />
      ) : (
        <div className={s.groups}>
          {groups.map(group => (
            <CreditGroup key={group.profession} group={group} />
          ))}
        </div>
      )}
    </section>
  )
}
