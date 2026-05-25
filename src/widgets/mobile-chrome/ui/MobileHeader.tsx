import { useNavigate } from 'react-router'
import { SearchIcon, ChevronLeftIcon } from '../../../shared/ui/Icon'

type MobileHeaderProps = {
  title?: string | null
  showSearch?: boolean
  onSearchFocus?: () => void
  onBack?: () => void
  rightAction?: React.ReactNode
}

export function MobileHeader({ title, showSearch = true, onSearchFocus, onBack, rightAction }: MobileHeaderProps) {
  const navigate = useNavigate()

  const handleSearchFocus = onSearchFocus ?? (() => navigate('/search'))

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 40,
      background: 'rgba(15,13,17,0.85)',
      backdropFilter: 'blur(14px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(14px) saturate(1.2)',
      borderBottom: '1px solid rgba(184,173,171,0.08)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 16px', minHeight: 52,
      }}>
        {onBack ? (
          <button onClick={onBack} style={{
            width: 36, height: 36, borderRadius: 999,
            background: 'rgba(184,173,171,0.06)',
            border: '1px solid rgba(184,173,171,0.1)',
            color: '#F2F0EF', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <ChevronLeftIcon size={14} />
          </button>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 1,
            fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 600,
            letterSpacing: '-0.02em', flexShrink: 0,
          }}>
            <span style={{ color: '#F2F0EF' }}>kino</span>
            <span style={{ color: '#D18E5F' }}>·</span>
            <span style={{ color: '#F2F0EF' }}>shka</span>
          </div>
        )}

        {title && (
          <div style={{
            flex: 1, textAlign: 'center',
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 500,
            letterSpacing: '-0.01em', color: '#F2F0EF',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{title}</div>
        )}

        {showSearch && !title && (
          <div
            onClick={handleSearchFocus}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8,
              height: 36, padding: '0 12px',
              background: '#18161B',
              border: '1px solid rgba(184,173,171,0.15)',
              borderRadius: 6, cursor: 'pointer',
              color: '#5A5059',
              fontFamily: 'var(--font-body)', fontSize: 13,
            }}
          >
            <SearchIcon size={14} />
            <span>Search…</span>
          </div>
        )}

        {rightAction ?? (
          <div style={{
            width: 32, height: 32, borderRadius: 999,
            background: 'linear-gradient(135deg, oklch(0.5 0.09 40), oklch(0.35 0.06 20))',
            border: '1px solid rgba(184,173,171,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#F2F0EF',
            flexShrink: 0, cursor: 'pointer',
          }}>AV</div>
        )}
      </div>
    </header>
  )
}
