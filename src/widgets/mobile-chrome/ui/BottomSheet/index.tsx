import { useEffect } from 'react'
import { CloseIcon } from '@shared/ui'
import s from './BottomSheet.module.css'

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
        className={`${s.backdrop} ${open ? s.backdropOpen : ''}`}
      />
      <div
        className={`${s.sheet} ${open ? s.sheetOpen : ''}`}
        style={{ height: `${heightVh}vh` }}
      >
        <div className={s.handle}>
          <div className={s.handleBar} />
        </div>
        <div className={s.titleRow}>
          <div className={s.title}>{title}</div>
          <button onClick={onClose} className={s.closeBtn}>
            <CloseIcon />
          </button>
        </div>
        <div className={s.body}>{children}</div>
      </div>
    </>
  )
}
