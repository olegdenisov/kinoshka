import { Link } from 'react-router'
import type { Movie } from '../../model/types'
import { Poster } from '../Poster'
import { StarIcon, PlusIcon, EyeIcon } from '@shared/ui'
import { CardBtn } from './CardBtn'
import s from './Card.module.css'

type CardProps = {
  movie: Movie
  variant?: 'grid' | 'compact'
}

export const Card = ({ movie, variant = 'grid' }: CardProps) => {
  return (
    <Link to={`/movie/${movie.id}`} className={s.card}>
      <div className={s.posterContainer}>
        <div className={s.posterWrapper}>
          <Poster movie={movie} showLabel={!movie.poster} />
        </div>

        <div className={s.overlay} />

        <div className={s.actions}>
          <CardBtn icon={<StarIcon size={10} />} label='Rate' />
          <CardBtn icon={<PlusIcon />} label='Add' />
          {variant === 'grid' && <CardBtn icon={<EyeIcon />} square />}
        </div>

        <div className={s.ratingBadge}>
          <StarIcon size={9} />
          {movie.rating.toFixed(1)}
        </div>

        <div className={s.typeBadge}>{movie.type}</div>
      </div>

      <div className={s.info}>
        <div className={s.title}>{movie.title}</div>
        <div className={s.meta}>
          <span>{movie.year ? movie.year : 'Unknown'}</span>
          <span className={s.metaDot}>·</span>
          <span>{movie.genre[0]}</span>
        </div>
      </div>
    </Link>
  )
}
