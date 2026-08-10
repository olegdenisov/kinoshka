import type { MovieDetail } from '@entities/movie'
import { formatCurrency } from '@entities/movie'
import s from './DetailsTab.module.css'

type DetailsTabProps = {
  m: MovieDetail
}

export const DetailsTab = ({ m }: DetailsTabProps) => {
  const rows = [
    { label: 'Release date', value: m.premiereWorld ?? '—' },
    { label: 'Country', value: m.countries.length > 0 ? m.countries.join(' · ') : '—' },
    { label: 'Runtime', value: m.runtime },
    { label: 'MPAA rating', value: m.ratingMpaa ?? '—' },
    { label: 'Age rating', value: m.ageRating != null ? `${m.ageRating}+` : '—' },
    { label: 'Budget', value: m.budget ? formatCurrency(m.budget) : '—' },
    { label: 'Box office', value: m.feesWorld ? formatCurrency(m.feesWorld) : '—' },
  ]
  return (
    <div className={s.root}>
      <div className={s.sectionHead}>Details</div>
      {rows.map((r, i) => (
        <div key={i} className={s.row}>
          <span className={s.rowLabel}>{r.label}</span>
          <span className={s.rowValue}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}
