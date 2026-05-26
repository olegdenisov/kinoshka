import type { Movie } from '../../model/types'
import { Poster } from '../Poster'
import { StarIcon } from '@shared/ui'
import s from './MobileCard.module.css'

type MobileCardProps = {
  movie: Movie
  onOpen?: (movie: Movie) => void
}

export function MobileCard({ movie, onOpen }: MobileCardProps) {
  return (
    <div onClick={() => onOpen?.(movie)} className={s.card}>
      <div className={s.posterWrapper}>
        <Poster movie={movie} showLabel={false} />
        <div className={s.rating}>
          <StarIcon size={8} />
          {movie.rating.toFixed(1)}
        </div>
      </div>
      <div className={s.title}>{movie.title}</div>
      <div className={s.meta}>
        <span>{movie.year}</span>
        <span className={s.metaDot}>·</span>
        <span>{movie.genre[0]}</span>
      </div>
    </div>
  )
}
