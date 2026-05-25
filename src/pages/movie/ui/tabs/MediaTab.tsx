import type { Movie } from '../../../../entities/movie/model/types'
import { PlayIcon } from '../../../../shared/ui/Icon'

export function MediaTab({ m }: { m: Movie }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Trailer</div>
        <div style={{
          aspectRatio: '16/9', maxWidth: 900,
          background: `linear-gradient(135deg, oklch(0.2 0.05 ${m.hue}), oklch(0.1 0.03 ${m.hue + 20}))`,
          border: '1px solid rgba(184,173,171,0.08)', borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.04, backgroundImage: 'repeating-linear-gradient(0deg, #F2F0EF 0, #F2F0EF 1px, transparent 1px, transparent 4px)' }} />
          <button style={{ width: 72, height: 72, borderRadius: 999, background: '#D18E5F', color: '#0F0D11', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 40px rgba(209,142,95,0.3)' }}>
            <PlayIcon size={22} />
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: '#92887F', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Screenshots</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} style={{
              aspectRatio: '16/9',
              background: `linear-gradient(${135 + i * 20}deg, oklch(0.2 0.05 ${m.hue + i * 15}), oklch(0.1 0.03 ${m.hue}))`,
              border: '1px solid rgba(184,173,171,0.06)', borderRadius: 4,
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}
