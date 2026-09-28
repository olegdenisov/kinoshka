import { formatDate } from '@entities/movie'
import type { PersonDetail } from '@entities/person'

import s from './PersonHero.module.css'

// В PersonDetail нет своего hue (в отличие от Movie) — фиксированный оттенок
// для градиента-заглушки, когда у персоны нет photo; то же значение и тот же
// приём, что в CastTab.tsx (сознательное дублирование константы предпочтено
// выносу в shared ради одной строки CSS-градиента).
const FALLBACK_HUE = 220

type TagPillProps = React.PropsWithChildren

const TagPill = ({ children }: TagPillProps) => (
  <span className={s.tagPill}>{children}</span>
)

type MetaRowProps = {
  label: string
  value: string
}

const MetaRow = ({ label, value }: MetaRowProps) => (
  <div className={s.metaRow}>
    <span className={s.metaLabel}>{label}</span>
    <span className={s.metaValue}>{value}</span>
  </div>
)

type PersonHeroProps = {
  person: PersonDetail
}

export const PersonHero = ({ person }: PersonHeroProps) => {
  const bornIn =
    person.birthPlace.length > 0 ? person.birthPlace.join(', ') : undefined
  // "Died in" показываем только если персона умерла — иначе пустой deathPlace[]
  // у живых персон не создаёт бессмысленную строку с лейблом без значения.
  const diedIn =
    person.death && person.deathPlace.length > 0
      ? person.deathPlace.join(', ')
      : undefined

  return (
    <section className={s.hero}>
      <div className={s.layout}>
        <div className={s.photo}>
          {person.photo ? (
            <img
              className={s.photoImage}
              src={person.photo}
              alt={person.name}
            />
          ) : (
            <div
              className={s.photoFallback}
              style={{
                background: `linear-gradient(145deg, oklch(0.35 0.06 ${FALLBACK_HUE}), oklch(0.15 0.03 ${FALLBACK_HUE + 20}))`,
              }}
            />
          )}
        </div>

        <div className={s.info}>
          {person.professions.length > 0 && (
            <div className={s.tags}>
              {person.professions.map(profession => (
                <TagPill key={profession}>{profession}</TagPill>
              ))}
            </div>
          )}

          <h1 className={s.heading}>{person.name}</h1>
          {person.enName && <div className={s.enName}>{person.enName}</div>}

          <div className={s.meta}>
            {person.birthday && (
              <MetaRow label='Born' value={formatDate(person.birthday)} />
            )}
            {person.death && (
              <MetaRow label='Died' value={formatDate(person.death)} />
            )}
            {person.age != null && (
              <MetaRow label='Age' value={String(person.age)} />
            )}
            {person.growth != null && (
              <MetaRow label='Height' value={`${person.growth} cm`} />
            )}
            {bornIn && <MetaRow label='Born in' value={bornIn} />}
            {diedIn && <MetaRow label='Died in' value={diedIn} />}
            {person.countAwards != null && (
              <MetaRow label='Awards' value={String(person.countAwards)} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
