import type { ActiveChip } from '../model/useFilterState'
import { CloseIcon } from '../../../shared/ui/Icon'

type ActiveFilterChipsProps = {
  chips: ActiveChip[]
  onClearAll?: () => void
  compact?: boolean
}

export function ActiveFilterChips({ chips, onClearAll, compact = false }: ActiveFilterChipsProps) {
  if (compact) {
    return (
      <>
        {chips.slice(0, 6).map((c, i) => (
          <span key={i} style={{
            flexShrink: 0,
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 6px 0 10px',
            background: 'rgba(209,142,95,0.12)',
            border: '1px solid rgba(209,142,95,0.3)',
            borderRadius: 999, color: '#D18E5F',
            fontFamily: 'var(--font-body)', fontSize: 12,
          }}>
            {c.label}
            <button onClick={c.onRemove} style={{
              width: 16, height: 16, borderRadius: 999, border: 'none',
              background: 'transparent', color: '#D18E5F', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <CloseIcon size={8} />
            </button>
          </span>
        ))}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {chips.map((c, i) => (
        <span key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 28, padding: '0 6px 0 10px',
          background: 'rgba(209,142,95,0.15)',
          border: '1px solid rgba(209,142,95,0.35)',
          borderRadius: 4, color: '#D18E5F',
          fontFamily: 'var(--font-body)', fontSize: 12, fontWeight: 500,
        }}>
          {c.label}
          <button onClick={c.onRemove} style={{
            width: 18, height: 18, borderRadius: 3, border: 'none',
            background: 'transparent', color: '#D18E5F', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CloseIcon size={10} />
          </button>
        </span>
      ))}
      {chips.length > 0 && onClearAll && (
        <button onClick={onClearAll} style={{
          height: 28, padding: '0 10px',
          background: 'transparent', border: 'none',
          color: '#92887F', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          Clear all
        </button>
      )}
    </div>
  )
}
