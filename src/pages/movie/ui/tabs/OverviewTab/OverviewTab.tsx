import type { MovieDetail } from '@entities/movie'
import s from './OverviewTab.module.css'

type SectionHeadProps = React.PropsWithChildren

const SectionHead = ({ children }: SectionHeadProps) => (
  <div className={s.sectionHead}>{children}</div>
)

type MetaRowProps = {
  label: string
  value: string
}

const MetaRow = ({ label, value }: MetaRowProps) => (
  <div className={s.metaRow}>
    <div className={s.metaLabel}>{label}</div>
    <div className={s.metaValue}>{value}</div>
  </div>
)

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
          {m.genre.map((g) => (
            <span key={g} className={s.genreBadge}>
              {g}
            </span>
          ))}
        </div>

        <div className={s.crew}>
          {m.crew.map((c) => (
            // ключ — не просто c.id: один человек может встречаться в persons несколько раз
            // с разными профессиями (напр. и режиссёр, и сценарист) — id одинаковый.
            <MetaRow key={`${c.id}-${c.profession}`} label={c.profession} value={c.name} />
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
          <SignalRow label="Kinopoisk" value={m.ratingKp != null ? m.ratingKp.toFixed(1) : '—'} />
          <SignalRow label="IMDb" value={m.ratingImdb != null ? m.ratingImdb.toFixed(1) : '—'} />
          <SignalRow label="MPAA" value={m.ratingMpaa ?? '—'} />
        </div>
      </aside>
    </div>
  )
}
