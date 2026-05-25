import { useState } from 'react'
import type { Movie } from '../model/types'
import { Poster } from './Poster'
import { StarIcon, PlusIcon, EyeIcon } from '../../../shared/ui/Icon'

type CardProps = {
  movie: Movie
  variant?: 'grid' | 'compact'
  onOpen?: (movie: Movie) => void
}

function CardBtn({ icon, label, square }: { icon: React.ReactNode; label?: string; square?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      onClick={(e) => e.stopPropagation()}
      style={{
        flex: square ? '0 0 auto' : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        height: 30, padding: square ? '0 8px' : '0 10px',
        borderRadius: 4, border: `1px solid ${h ? 'transparent' : 'rgba(184,173,171,0.18)'}`,
        cursor: 'pointer',
        background: h ? '#D18E5F' : 'rgba(15,13,17,0.8)',
        color: h ? '#0F0D11' : '#F2F0EF',
        fontFamily: 'var(--font-mono)', fontSize: 10.5, letterSpacing: '0.08em',
        textTransform: 'uppercase',
        backdropFilter: 'blur(6px)',
        transition: 'all 160ms',
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}

export function Card({ movie, variant = 'grid', onOpen }: CardProps) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen?.(movie)}
      style={{
        cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10,
        transition: 'transform 240ms cubic-bezier(.2,.7,.2,1)',
        transform: hover ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ position: 'relative' }}>
        <div style={{
          transition: 'transform 320ms cubic-bezier(.2,.7,.2,1)',
          transform: hover ? 'scale(1.02)' : 'scale(1)',
          transformOrigin: 'center',
        }}>
          <Poster movie={movie} />
        </div>

        <div style={{
          position: 'absolute', inset: 0, borderRadius: 6,
          background: 'linear-gradient(180deg, transparent 40%, rgba(209,142,95,0.18) 100%)',
          opacity: hover ? 1 : 0, transition: 'opacity 220ms',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'absolute', left: 10, right: 10, bottom: 10,
          display: 'flex', gap: 6,
          opacity: hover ? 1 : 0,
          transform: hover ? 'translateY(0)' : 'translateY(4px)',
          transition: 'all 220ms',
        }}>
          <CardBtn icon={<StarIcon size={10} />} label="Rate" />
          <CardBtn icon={<PlusIcon />} label="Add" />
          {variant === 'grid' && <CardBtn icon={<EyeIcon />} square />}
        </div>

        <div style={{
          position: 'absolute', top: 10, left: 10,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '4px 7px 4px 6px', borderRadius: 4,
          background: 'rgba(15,13,17,0.72)', backdropFilter: 'blur(6px)',
          fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 500,
          color: '#E6B86A', letterSpacing: '0.02em',
          border: '1px solid rgba(230,184,106,0.2)',
        }}>
          <StarIcon size={9} />
          {movie.rating.toFixed(1)}
        </div>

        <div style={{
          position: 'absolute', top: 10, right: 10,
          padding: '3px 7px', borderRadius: 3,
          background: 'rgba(15,13,17,0.72)', backdropFilter: 'blur(6px)',
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(242,240,239,0.7)',
          border: '1px solid rgba(184,173,171,0.12)',
        }}>
          {movie.type}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 14.5, fontWeight: 500,
          color: hover ? '#D7EEF3' : 'var(--text-primary)',
          letterSpacing: '-0.01em', lineHeight: 1.25,
          transition: 'color 200ms',
        }}>
          {movie.title}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10.5,
          color: 'var(--text-muted)', letterSpacing: '0.04em',
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span>{movie.year}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{movie.genre[0]}</span>
        </div>
      </div>
    </div>
  )
}
