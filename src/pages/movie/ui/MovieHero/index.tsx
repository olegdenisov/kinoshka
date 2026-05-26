import { useNavigate } from 'react-router'
import type { Movie } from '@entities/movie'
import { Poster, MOCK_DETAIL } from '@entities/movie'
import { StarIcon, PlayIcon } from '@shared/ui'
import type { LikedState } from '../MovieDesktop/types'
import { MovieActions } from '../MovieActions'
import s from './MovieHero.module.css'

function TagPill({ children }: { children: React.ReactNode }) {
  return <span className={s.tagPill}>{children}</span>
}

function RatingBlock({ label, value, sub, accentClass, icon }: { label: string; value: string; sub: string; accentClass: string; icon?: React.ReactNode }) {
  return (
    <div className={s.ratingBlock}>
      <div className={s.ratingLabel}>{label}</div>
      <div className={`${s.ratingValue} ${accentClass}`}>{icon}{value}</div>
      <div className={s.ratingSub}>{sub}</div>
    </div>
  )
}

type MovieHeroProps = {
  movie: Movie
  liked: LikedState
  onLikedChange: (l: LikedState) => void
}

export function MovieHero({ movie, liked, onLikedChange }: MovieHeroProps) {
  const navigate = useNavigate()

  return (
    <section className={s.hero}>
      <div className={s.backdrop}>
        <div
          className={s.backdropGradient}
          style={{ background: `radial-gradient(ellipse 50% 60% at 30% 30%, oklch(0.32 0.1 ${movie.hue} / 0.6), transparent 70%), radial-gradient(ellipse 40% 50% at 75% 40%, oklch(0.28 0.08 ${movie.hue + 30} / 0.4), transparent 70%), #0F0D11` }}
        />
        <div className={s.backdropOverlay} />
        <div className={s.backdropLines} />
      </div>

      <div className={s.inner}>
        <nav className={s.breadcrumbs}>
          <span className={s.breadcrumbLink} onClick={() => navigate('/')}>Home</span>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbLink} onClick={() => navigate('/search')}>Catalog</span>
          <span className={s.breadcrumbSep}>/</span>
          <span className={s.breadcrumbCurrent}>{movie.title}</span>
        </nav>

        <div className={s.layout}>
          <div className={s.poster}>
            <Poster movie={movie} showLabel={false} />
            <button className={s.trailerBtn}>
              <PlayIcon size={10} />
              Trailer
            </button>
          </div>

          <div className={s.info}>
            <div className={s.tags}>
              <TagPill>{movie.type}</TagPill>
              <TagPill>{movie.year}</TagPill>
              <TagPill>{movie.runtime}</TagPill>
              <TagPill>{movie.genre[0]}</TagPill>
            </div>

            <h1 className={s.heading}>{movie.title}</h1>
            <div className={s.tagline}>{MOCK_DETAIL.tagline}</div>

            <div className={s.ratings}>
              <RatingBlock label="Users" value={movie.rating.toFixed(1)} sub={`${MOCK_DETAIL.userVotes} votes`} accentClass={s.accentGold} icon={<StarIcon size={12} />} />
              <RatingBlock label="Critics" value={MOCK_DETAIL.criticScore} sub={`${MOCK_DETAIL.criticReviews} reviews`} accentClass={s.accentBlue} />
              <RatingBlock label="Your rating" value="—" sub="Not rated" accentClass={s.accentMuted} />
            </div>

            <MovieActions liked={liked} onChange={onLikedChange} />

            <p className={s.synopsis}>{MOCK_DETAIL.synopsis.split('\n')[0]}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
