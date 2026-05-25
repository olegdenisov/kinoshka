import type { CSSProperties } from 'react'
import type { Movie } from '../model/types'

type PosterProps = {
  movie: Movie
  ratio?: string
  showLabel?: boolean
}

export function Poster({ movie, ratio = '2/3', showLabel = true }: PosterProps) {
  const hue = movie.hue ?? 20

  const bg = `linear-gradient(155deg,
    oklch(0.22 0.04 ${hue}) 0%,
    oklch(0.14 0.03 ${hue + 10}) 60%,
    oklch(0.08 0.02 ${hue}) 100%)`

  const grain = `repeating-linear-gradient(
    135deg,
    rgba(255,255,255,0.015) 0px,
    rgba(255,255,255,0.015) 1px,
    transparent 1px,
    transparent 4px)`

  return (
    <div style={{
      aspectRatio: ratio,
      background: bg,
      borderRadius: 6,
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 40px -24px rgba(0,0,0,0.7)',
    } as CSSProperties}>
      <div style={{ position: 'absolute', inset: 0, background: grain, mixBlendMode: 'overlay' }} />
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.06), transparent 60%)',
      }} />
      <div style={{
        position: 'absolute', left: '-10%', right: '-10%', top: '38%', height: '24%',
        background: `linear-gradient(90deg, transparent, oklch(0.4 0.08 ${hue} / 0.25), transparent)`,
        filter: 'blur(18px)',
      }} />
      {showLabel && (
        <div style={{
          position: 'absolute', left: 12, right: 12, bottom: 12,
          fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(242,240,239,0.55)',
        }}>
          <div style={{ opacity: 0.5, marginBottom: 4 }}>— poster —</div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 13,
            letterSpacing: '-0.01em', textTransform: 'none',
            color: 'rgba(242,240,239,0.85)', lineHeight: 1.15,
          }}>
            {movie.title}
          </div>
        </div>
      )}
    </div>
  )
}
