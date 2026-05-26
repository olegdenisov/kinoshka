import type { Movie } from '@entities/movie'
import { MOCK_DETAIL } from '@entities/movie'
import s from './DetailsTab.module.css'

export function DetailsTab({ m }: { m: Movie }) {
  const { details } = MOCK_DETAIL
  const rows = [
    { label: 'Release date', value: details.releaseDate },
    { label: 'Country', value: details.country },
    { label: 'Language', value: details.language },
    { label: 'Runtime', value: m.runtime },
    { label: 'Aspect ratio', value: details.aspectRatio },
    { label: 'Sound mix', value: details.soundMix },
    { label: 'Budget', value: details.budget },
    { label: 'Box office', value: details.boxOffice },
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
