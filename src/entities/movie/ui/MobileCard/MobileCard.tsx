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
    <div className={s.card}>
      {/*
        DOM order is title-before-poster so the title Link is reachable via
        Tab before the favorite button inside posterWrapper. Visual order
        (poster on top) is restored purely via CSS `order` — see
        MobileCard.module.css.
      */}
      <Link to={`/movie/${movie.id}`} className={s.title}>
        <span className={s.titleText}>{movie.title}</span>
      </Link>
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
            onClick={() => onToggleFavorite(movie.id)}
          >
            <HeartIcon size={13} filled={isFavorite} />
          </button>
        )}
      </div>
      <div className={s.meta}>
        <span>{movie.year ? movie.year : 'Unknown'}</span>
        <span className={s.metaDot}>·</span>
        <span>{movie.genre[0]}</span>
      </div>
    </div>
  )
}
