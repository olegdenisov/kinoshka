import { useEffect } from 'react'
import { CloseIcon } from '../../../shared/ui/Icon'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  heightVh?: number
}

export function BottomSheet({ open, onClose, title, children, heightVh = 82 }: BottomSheetProps) {
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
          opacity: open ? 1 : 0, pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 220ms',
        }}
      />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 61,
        height: `${heightVh}vh`,
        background: '#18161B',
        borderTop: '1px solid rgba(184,173,171,0.12)',
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 280ms cubic-bezier(.2,.7,.2,1)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -20px 40px -10px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: 'rgba(184,173,171,0.2)' }} />
        </div>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 20px 12px',
          borderBottom: '1px solid rgba(184,173,171,0.08)',
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500,
            letterSpacing: '-0.01em', color: '#F2F0EF',
          }}>{title}</div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 999,
            background: 'rgba(184,173,171,0.08)', border: 'none',
            color: '#B8ADAB', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CloseIcon />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {children}
        </div>
      </div>
    </>
  )
}
