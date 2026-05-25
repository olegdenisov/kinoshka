import type { Movie } from '../model/types'
import { Poster } from './Poster'
import { StarIcon } from '../../../shared/ui/Icon'

type MobileCardProps = {
  movie: Movie
  onOpen?: (movie: Movie) => void
}

export function MobileCard({ movie, onOpen }: MobileCardProps) {
  return (
    <div onClick={() => onOpen?.(movie)} style={{ cursor: 'pointer' }}>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <Poster movie={movie} showLabel={false} />
        <div style={{
          position: 'absolute', top: 8, left: 8,
          display: 'inline-flex', alignItems: 'center', gap: 3,
          padding: '3px 6px 3px 5px', borderRadius: 3,
          background: 'rgba(15,13,17,0.75)', backdropFilter: 'blur(6px)',
          fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 500,
          color: '#E6B86A', letterSpacing: '0.02em',
          border: '1px solid rgba(230,184,106,0.2)',
        }}>
          <StarIcon size={8} />
          {movie.rating.toFixed(1)}
        </div>
      </div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 500,
        color: '#F2F0EF', letterSpacing: '-0.01em', lineHeight: 1.25,
        marginBottom: 2, overflow: 'hidden',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>
        {movie.title}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 10,
        color: '#92887F', letterSpacing: '0.04em',
        display: 'flex', gap: 6, alignItems: 'center',
      }}>
        <span>{movie.year}</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>{movie.genre[0]}</span>
      </div>
    </div>
  )
}
