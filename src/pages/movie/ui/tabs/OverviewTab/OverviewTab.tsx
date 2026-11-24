import type { CrewMember, MovieDetail } from '@entities/movie'
import { paths } from '@shared/config'
import type { ReactNode } from 'react'

import { groupCrewByProfession } from '../../../lib/groupCrewByProfession'

import s from './OverviewTab.module.css'

type SectionHeadProps = React.PropsWithChildren

const SectionHead = ({ children }: SectionHeadProps) => (
  <div className={s.sectionHead}>{children}</div>
)

type MetaRowProps = {
  label: string
  value: ReactNode
}

const MetaRow = ({ label, value }: MetaRowProps) => (
  <div className={s.metaRow}>
    <div className={s.metaLabel}>{label}</div>
    <div className={s.metaValue}>{value}</div>
  </div>
)

type CrewMemberListProps = {
  members: CrewMember[]
}

const CrewMemberList = ({ members }: CrewMemberListProps) => {
  // DTO не гарантирует имя члена съёмочной группы (mapDtoToMovieDetail может отдать
  // name: ''). У пустого имени нет ни текста, ни ссылки — нечего показывать, поэтому
  // такие записи отбрасываем ещё до расстановки разделителей ", ": иначе запись без
  // имени, оказавшись не первой в группе, оставляла бы висячий разделитель без пары
  // (', ' и дальше пусто). axe-правило link-name критично и уронило бы checkA11y на
  // живых данных (Задача 14), а имя без ссылки не имеет смысла отдельно от этого.
  const named = members.filter(m => m.name)

  return (
    <>
      {named.map((m, i) => (
        // Ключ включает индекс: один и тот же id персоны может встретиться дважды в одной
        // профессии (дубли персон в API) — одного id как ключа недостаточно.
        <span key={`${m.id}-${i}`}>
          {i > 0 && ', '}
          <a href={paths.person(m.id)} className={s.crewLink}>
            {m.name}
          </a>
        </span>
      ))}
    </>
  )
}

type SignalRowProps = {
  label: string
  value: string
}

const SignalRow = ({ label, value }: SignalRowProps) => (
  <div className={s.signalRow}>
    <span className={s.signalLabel}>{label}</span>
    <span className={s.signalValue}>{value}</span>
  </div>
)

type OverviewTabProps = {
  m: MovieDetail
}

export const OverviewTab = ({ m }: OverviewTabProps) => {
  return (
    <div className={s.root}>
      <div>
        <SectionHead>Synopsis</SectionHead>
        <p className={s.synopsis}>{m.synopsis}</p>

        <SectionHead>Genres</SectionHead>
        <div className={s.genres}>
          {m.genre.map(g => (
            <span key={g} className={s.genreBadge}>
              {g}
            </span>
          ))}
        </div>

        <div className={s.crew}>
          {groupCrewByProfession(m.crew)
            // Профессия, где у всех членов пустое имя, не даёт ни текста, ни ссылки —
            // строка вида "Продюсер: " без значения выглядела бы как баг, поэтому такую
            // группу целиком не рендерим.
            .filter(({ members }) => members.some(mm => mm.name))
            .map(({ profession, members }) => (
              <MetaRow
                key={profession}
                label={profession}
                value={<CrewMemberList members={members} />}
              />
            ))}
        </div>
      </div>

      <aside className={s.sidebar}>
        <div className={s.signalsBox}>
          <SectionHead>Countries</SectionHead>
          <p className={s.countriesText}>
            {m.countries.length > 0 ? m.countries.join(' · ') : '—'}
          </p>
        </div>

        <div className={s.signalsBox}>
          <SectionHead>Ratings</SectionHead>
          <SignalRow
            label='Kinopoisk'
            value={m.ratingKp != null ? m.ratingKp.toFixed(1) : '—'}
          />
          <SignalRow
            label='IMDb'
            value={m.ratingImdb != null ? m.ratingImdb.toFixed(1) : '—'}
          />
          <SignalRow label='MPAA' value={m.ratingMpaa ?? '—'} />
        </div>
      </aside>
    </div>
  )
}
