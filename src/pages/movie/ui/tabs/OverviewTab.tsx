import type { Movie } from '../../../../entities/movie/model/types'
import { MOCK_DETAIL } from '../../../../entities/movie/model/catalog'

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>{children}</div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingBottom: 12, borderBottom: '1px solid rgba(184,173,171,0.08)' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#5A5059', letterSpacing: '0.14em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#F2F0EF' }}>{value}</div>
    </div>
  )
}

function SignalRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : '1px solid rgba(184,173,171,0.06)' }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: '#92887F' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, color: '#F2F0EF' }}>{value}</span>
    </div>
  )
}

export function OverviewTab({ m }: { m: Movie }) {
  const detail = MOCK_DETAIL

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 64 }}>
      <div>
        <SectionHead>Synopsis</SectionHead>
        <p style={{ margin: '0 0 32px', maxWidth: 640, fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.65, color: '#F2F0EF', letterSpacing: '-0.003em' }}>
          {detail.synopsis}
        </p>

        <SectionHead>Genres</SectionHead>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 32 }}>
          {m.genre.map((g) => (
            <span key={g} style={{ height: 28, padding: '0 12px', display: 'inline-flex', alignItems: 'center', background: 'rgba(184,173,171,0.06)', border: '1px solid rgba(184,173,171,0.12)', borderRadius: 4, fontFamily: 'var(--font-body)', fontSize: 12.5, color: '#B8ADAB' }}>{g}</span>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <MetaRow label="Director" value={detail.crew.director} />
          <MetaRow label="Writer" value={detail.crew.writer} />
          <MetaRow label="Composer" value={detail.crew.composer} />
          <MetaRow label="Studio" value={detail.crew.studio} />
        </div>
      </div>

      <aside>
        <div style={{ background: '#18161B', border: '1px solid rgba(184,173,171,0.08)', borderRadius: 8, padding: 24 }}>
          <SectionHead>Signals</SectionHead>
          <SignalRow label="Critical consensus" value={detail.signals.criticalConsensus} />
          <SignalRow label="Audience" value={detail.signals.audience} />
          <SignalRow label="Pacing" value={detail.signals.pacing} />
          <SignalRow label="Mood" value={detail.signals.mood} />
          <SignalRow label="Violence" value={detail.signals.violence} />
          <SignalRow label="Tear risk" value={detail.signals.tearRisk} last />
        </div>

        <div style={{ marginTop: 16, background: 'linear-gradient(135deg, rgba(209,142,95,0.12), rgba(209,142,95,0.02))', border: '1px solid rgba(209,142,95,0.25)', borderRadius: 8, padding: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#D18E5F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Why it's for you</div>
          <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13.5, lineHeight: 1.55, color: '#F2F0EF' }}>
            You rated <em style={{ color: '#D7EEF3', fontStyle: 'normal' }}>Glasswater</em> 9.0 and watched three slow-burn sci-fi films this month. This sits in that same key.
          </p>
        </div>
      </aside>
    </div>
  )
}
