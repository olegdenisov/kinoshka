import type { Movie } from '@entities/movie'
import { MOCK_DETAIL } from '@entities/movie'
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
  m: Movie
}

export const OverviewTab = ({ m }: OverviewTabProps) => {
  const detail = MOCK_DETAIL

  return (
    <div className={s.root}>
      <div>
        <SectionHead>Synopsis</SectionHead>
        <p className={s.synopsis}>{detail.synopsis}</p>

        <SectionHead>Genres</SectionHead>
        <div className={s.genres}>
          {m.genre.map((g) => (
            <span key={g} className={s.genreBadge}>{g}</span>
          ))}
        </div>

        <div className={s.crew}>
          <MetaRow label="Director" value={detail.crew.director} />
          <MetaRow label="Writer" value={detail.crew.writer} />
          <MetaRow label="Composer" value={detail.crew.composer} />
          <MetaRow label="Studio" value={detail.crew.studio} />
        </div>
      </div>

      <aside>
        <div className={s.signalsBox}>
          <SectionHead>Signals</SectionHead>
          <SignalRow label="Critical consensus" value={detail.signals.criticalConsensus} />
          <SignalRow label="Audience" value={detail.signals.audience} />
          <SignalRow label="Pacing" value={detail.signals.pacing} />
          <SignalRow label="Mood" value={detail.signals.mood} />
          <SignalRow label="Violence" value={detail.signals.violence} />
          <SignalRow label="Tear risk" value={detail.signals.tearRisk} />
        </div>

        <div className={s.recommendBox}>
          <div className={s.recommendLabel}>Why it's for you</div>
          <p className={s.recommendText}>
            You rated <em className={s.recommendHighlight}>Glasswater</em> 9.0 and watched three slow-burn sci-fi films this month. This sits in that same key.
          </p>
        </div>
      </aside>
    </div>
  )
}
