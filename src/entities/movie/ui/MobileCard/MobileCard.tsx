import { StarIcon } from '@shared/ui'
import { Link } from 'react-router'

import type { Movie } from '../../model/types'
import { Poster } from '../Poster'

import s from './MobileCard.module.css'

type MobileCardProps = {
  movie: Movie
}

export const MobileCard = ({ movie }: MobileCardProps) => {
  return (
    <Link to={`/movie/${movie.id}`} className={s.card}>
      <div className={s.posterWrapper}>
        <Poster movie={movie} showLabel={false} />
        <div className={s.rating}>
          <StarIcon size={8} />
          {movie.rating.toFixed(1)}
        </div>
      </div>
      <div className={s.title}>{movie.title}</div>
      <div className={s.meta}>
        <span>{movie.year ? movie.year : 'Unknown'}</span>
        <span className={s.metaDot}>·</span>
        <span>{movie.genre[0]}</span>
      </div>
    </Link>
  )
}
