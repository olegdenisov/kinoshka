import type { Movie } from '../../../../entities/movie/model/types'
import { MOCK_DETAIL } from '../../../../entities/movie/model/catalog'

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
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Details</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '200px 1fr', padding: '14px 0', borderBottom: '1px solid rgba(184,173,171,0.08)' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#92887F', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{r.label}</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#F2F0EF' }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}
