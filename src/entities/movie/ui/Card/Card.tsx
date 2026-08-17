import { StarIcon, PlusIcon, EyeIcon, HeartIcon } from '@shared/ui'
import { Link } from 'react-router'

import type { Movie } from '../../model/types'
import { Poster } from '../Poster'
import { CardBtn } from './CardBtn'

import s from './Card.module.css'

type CardProps = {
  movie: Movie
  variant?: 'grid' | 'compact'
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
}

export const Card = ({
  movie,
  variant = 'grid',
  isFavorite,
  onToggleFavorite,
}: CardProps) => {
  return (
    <div className={s.card}>
      <div className={s.posterContainer}>
        <div className={s.posterWrapper}>
          <Poster movie={movie} showLabel={!movie.poster} />
        </div>

        <div className={s.overlay} />

        <div className={s.actions}>
          <CardBtn icon={<StarIcon size={10} />} label='Rate' />
          <CardBtn icon={<PlusIcon />} label='Add' />
          {variant === 'grid' && <CardBtn icon={<EyeIcon />} square />}
          {onToggleFavorite && (
            <CardBtn
              icon={<HeartIcon size={10} filled={isFavorite} />}
              active={isFavorite}
              square
              ariaLabel={
                isFavorite ? 'Remove from favorites' : 'Add to favorites'
              }
              onClick={() => onToggleFavorite(movie.id)}
            />
          )}
        </div>

        <div className={s.ratingBadge}>
          <StarIcon size={9} />
          {movie.rating.toFixed(1)}
        </div>

        <div className={s.typeBadge}>{movie.type}</div>
      </div>

      <div className={s.info}>
        <Link to={`/movie/${movie.id}`} className={s.title}>
          {movie.title}
        </Link>
        <div className={s.meta}>
          <span>{movie.year ? movie.year : 'Unknown'}</span>
          <span className={s.metaDot}>·</span>
          <span>{movie.genre[0]}</span>
        </div>
      </div>
    </div>
  )
}
