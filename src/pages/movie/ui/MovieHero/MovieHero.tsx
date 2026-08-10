import { Link } from 'react-router'
import type { MovieDetail } from '@entities/movie'
import { Poster } from '@entities/movie'
import { StarIcon, PlayIcon } from '@shared/ui'
import type { LikedState } from '../MovieDesktop/types'
import { MovieActions } from '../MovieActions'
import s from './MovieHero.module.css'

type TagPillProps = React.PropsWithChildren

const TagPill = ({ children }: TagPillProps) => <span className={s.tagPill}>{children}</span>

type RatingBlockProps = {
  label: string
  value: string
  sub: string
  accentClass: string
  icon?: React.ReactNode
}

const RatingBlock = ({ label, value, sub, accentClass, icon }: RatingBlockProps) => (
  <div className={s.ratingBlock}>
    <div className={s.ratingLabel}>{label}</div>
    <div className={`${s.ratingValue} ${accentClass}`}>
      {icon}
      {value}
    </div>
    <div className={s.ratingSub}>{sub}</div>
  </div>
)

type MovieHeroProps = {
  movie: MovieDetail
  liked: LikedState
  onLikedChange: (l: LikedState) => void
}

export const MovieHero = ({ movie, liked, onLikedChange }: MovieHeroProps) => {
  return (
    <section className={s.hero}>
      <div className={s.backdrop}>
        {movie.backdrop ? (
          <div className={s.backdropImage} style={{ backgroundImage: `url(${movie.backdrop})` }} />
        ) : (
          <div
            className={s.backdropGradient}
            style={{
              background: `radial-gradient(ellipse 50% 60% at 30% 30%, oklch(0.32 0.1 ${movie.hue} / 0.6), transparent 70%), radial-gradient(ellipse 40% 50% at 75% 40%, oklch(0.28 0.08 ${movie.hue + 30} / 0.4), transparent 70%), var(--bg-primary)`,
            }}
          />
        )}
        <div className={s.backdropOverlay} />
        <div className={s.backdropLines} />
      </div>

      <div className={s.inner}>
        <nav className={s.breadcrumbs}>
          <Link to='/' className={s.breadcrumbLink}>
            Home
          </Link>
          <span className={s.breadcrumbSep}>/</span>
          <Link to='/search' className={s.breadcrumbLink}>
            Catalog
          </Link>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbCurrent}>{movie.title}</span>
        </nav>

        <div className={s.layout}>
          <div className={s.poster}>
            <Poster movie={movie} showLabel={false} />
            {movie.trailerUrl && (
              <a className={s.trailerBtn} href={movie.trailerUrl} target='_blank' rel='noreferrer'>
                <PlayIcon size={10} />
                Trailer
              </a>
            )}
          </div>

          <div className={s.info}>
            <div className={s.tags}>
              <TagPill>{movie.type}</TagPill>
              <TagPill>{movie.year}</TagPill>
              <TagPill>{movie.runtime}</TagPill>
              <TagPill>{movie.genre[0]}</TagPill>
            </div>

            <h1 className={s.heading}>{movie.title}</h1>
            <div className={s.tagline}>{movie.tagline}</div>

            <div className={s.ratings}>
              <RatingBlock
                label='Users'
                value={movie.rating.toFixed(1)}
                sub={`${movie.votesKp ?? '—'} votes`}
                accentClass={s.accentGold}
                icon={<StarIcon size={12} />}
              />
              <RatingBlock
                label='Critics'
                value={movie.criticScore != null ? `${movie.criticScore.toFixed(0)}%` : '—'}
                sub={`${movie.criticReviewCount ?? '—'} reviews`}
                accentClass={s.accentBlue}
              />
              <RatingBlock
                label='Your rating'
                value='—'
                sub='Not rated'
                accentClass={s.accentMuted}
              />
            </div>

            <MovieActions liked={liked} onChange={onLikedChange} />

            <p className={s.synopsis}>{movie.shortSynopsis ?? movie.synopsis}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
