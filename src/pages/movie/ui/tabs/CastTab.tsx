import { MOCK_DETAIL } from '../../../../entities/movie/model/catalog'

export function CastTab() {
  const { cast } = MOCK_DETAIL
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Cast</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 20 }}>
        {cast.map((c) => (
          <div key={c.name} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{
              aspectRatio: '1', borderRadius: 999,
              background: `linear-gradient(145deg, oklch(0.35 0.06 ${c.hue}), oklch(0.15 0.03 ${c.hue + 20}))`,
              border: '1px solid rgba(184,173,171,0.1)',
            }} />
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500, color: '#F2F0EF', letterSpacing: '-0.01em' }}>{c.actor}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.06em', marginTop: 2 }}>as {c.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
