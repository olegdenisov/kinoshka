import { StarIcon, PlusIcon, EyeIcon, HeartIcon } from '@shared/ui'
import type { ReactNode } from 'react'
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
  rankBadge?: ReactNode
}

export const Card = ({
  movie,
  variant = 'grid',
  isFavorite,
  onToggleFavorite,
  rankBadge,
}: CardProps) => {
  return (
    <div className={s.card}>
      {/*
        DOM order is intentionally info-before-poster so the title Link is
        reachable via Tab before the (unlabeled) action buttons inside
        posterContainer. Visual order (poster on top) is restored purely via
        CSS `order` on .info — see Card.module.css.
      */}
      <div className={s.info}>
        <Link to={`/movie/${movie.id}`} className={s.title}>
          {movie.title}
        </Link>
        <div className={s.meta}>
          <span>{movie.year ? movie.year : 'Unknown'}</span>
          {movie.genre[0] && (
            <>
              <span className={s.metaDot}>·</span>
              <span>{movie.genre[0]}</span>
            </>
          )}
        </div>
      </div>

      <div className={s.posterContainer}>
        <div className={s.posterWrapper}>
          <Poster movie={movie} showLabel={!movie.poster} />
        </div>

        <div className={s.overlay} />

        {/*
          Rate/Add/Eye — decorative-extra controls, no touch-device analog
          (hover doesn't mean anything on touch): rendered unconditionally,
          hidden via `@media (hover: none)` in Card.module.css instead of a
          JS isMobile check, so a real browser strips them from the tab
          order too. Eye keeps its existing `variant === 'grid'` gate.
        */}
        <div className={s.actions}>
          <CardBtn icon={<StarIcon size={10} />} label='Rate' />
          <CardBtn icon={<PlusIcon />} label='Add' />
          {variant === 'grid' && <CardBtn icon={<EyeIcon />} square />}
        </div>

        {/*
          Единая кнопка избранного — один DOM-узел на оба брейкпоинта (было
          два узла с одинаковым aria-label: CardBtn внутри .actions у Card и
          отдельная .favoriteBtn у MobileCard). Позиция/вид переключаются
          CSS-ом (top-right круг на мобильном, bottom-right квадрат в
          hover-ряду на десктопе) — см. .favoriteBtn в Card.module.css.
        */}
        {onToggleFavorite && (
          <button
            type='button'
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            className={`${s.favoriteBtn} ${isFavorite ? s.favoriteBtnActive : ''}`}
            onClick={() => onToggleFavorite(movie.id)}
          >
            <HeartIcon size={12} filled={isFavorite} />
          </button>
        )}

        <div className={s.topBadges}>
          <div className={s.ratingBadge}>
            <StarIcon size={9} />
            {movie.rating.toFixed(1)}
          </div>

          {rankBadge}
        </div>

        <div className={s.typeBadge}>{movie.type}</div>
      </div>
    </div>
  )
}
