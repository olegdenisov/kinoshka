import { StarIcon, HeartIcon } from '@shared/ui'
import { Link } from 'react-router'

import type { Movie } from '../../model/types'
import { Poster } from '../Poster'

import s from './MobileCard.module.css'

type MobileCardProps = {
  movie: Movie
  isFavorite?: boolean
  onToggleFavorite?: (id: number) => void
}

export const MobileCard = ({
  movie,
  isFavorite,
  onToggleFavorite,
}: MobileCardProps) => {
  return (
    <Link to={`/movie/${movie.id}`} className={s.card}>
      <div className={s.posterWrapper}>
        <Poster movie={movie} showLabel={false} />
        <div className={s.rating}>
          <StarIcon size={8} />
          {movie.rating.toFixed(1)}
        </div>
        {onToggleFavorite && (
          <button
            type='button'
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            className={`${s.favoriteBtn} ${isFavorite ? s.favoriteBtnActive : ''}`}
            onClick={e => {
              e.preventDefault()
              e.stopPropagation()
              onToggleFavorite(movie.id)
            }}
          >
            <HeartIcon size={13} filled={isFavorite} />
          </button>
        )}
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
