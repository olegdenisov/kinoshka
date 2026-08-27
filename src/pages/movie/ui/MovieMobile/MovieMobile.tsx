import type { CastMember, MovieDetail, MovieImage } from '@entities/movie'
import { Poster, Card, formatCurrency, formatDate } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import {
  StarIcon,
  PlusIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  PlayIcon,
} from '@shared/ui'
import { MobileHeader, BottomNav } from '@widgets/mobile-chrome'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router'

import s from './MovieMobile.module.css'

type LikedState = {
  rate: boolean
  list: boolean
  watched: boolean
  fav: boolean
}

type TagPillMiniProps = React.PropsWithChildren

const TagPillMini = ({ children }: TagPillMiniProps) => (
  <span className={s.tagPill}>{children}</span>
)

type MiniStatProps = {
  label: string
  value: string
  accent: string
}

const MiniStat = ({ label, value, accent }: MiniStatProps) => (
  <div className={s.statItem}>
    <div className={s.statLabel}>{label}</div>
    <div className={s.statValue} style={{ color: accent }}>
      {value}
    </div>
  </div>
)

type MobileActionBtnProps = {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

const MobileActionBtn = ({
  icon,
  label,
  active,
  onClick,
}: MobileActionBtnProps) => {
  return (
    <button
      type='button'
      onClick={onClick}
      className={`${s.actionBtn} ${active ? s.actionBtnActive : ''}`}
    >
      {icon}
      {label}
    </button>
  )
}

type MovieMobileProps = {
  movie: MovieDetail
  images: MovieImage[]
}

export const MovieMobile = ({ movie, images }: MovieMobileProps) => {
  const navigate = useNavigate()
  const { isFavorite, toggle } = useFavorites()
  const [tab, setTab] = useState('Overview')
  const [liked, setLiked] = useState<LikedState>({
    rate: false,
    list: false,
    watched: true,
    fav: false,
  })
  const related = movie.similarMovies.slice(0, 6)
  const tabs = ['Overview', 'Cast', 'Media', 'Details']

  return (
    <div className={s.page}>
      <MobileHeader
        onBack={() => navigate(-1)}
        showSearch={false}
        rightAction={
          <button type='button' className={s.shareBtn}>
            <ShareIcon />
          </button>
        }
      />

      <section className={s.hero}>
        <div className={s.heroBackdropLayer}>
          {movie.backdrop ? (
            <div
              className={s.heroBackdropImage}
              style={{ backgroundImage: `url(${movie.backdrop})` }}
            />
          ) : (
            <div
              className={s.heroFallbackGradient}
              style={{ '--hue': movie.hue } as CSSProperties}
            />
          )}
          <div className={s.heroScrim} />
        </div>

        <div className={s.heroContent}>
          <div className={s.posterWrap}>
            <Poster movie={movie} showLabel={false} />
          </div>

          <div className={s.tagRow}>
            <TagPillMini>{movie.type}</TagPillMini>
            <TagPillMini>{movie.year}</TagPillMini>
            <TagPillMini>{movie.runtime}</TagPillMini>
            <TagPillMini>{movie.genre[0]}</TagPillMini>
          </div>

          <h1 className={s.title}>{movie.title}</h1>
          <div className={s.tagline}>{movie.tagline}</div>

          <div className={s.statsRow}>
            <MiniStat
              label='Users'
              value={movie.rating.toFixed(1)}
              accent='var(--accent-rating)'
            />
            <MiniStat
              label='Critics'
              value={
                movie.criticScore != null
                  ? `${movie.criticScore.toFixed(0)}%`
                  : '—'
              }
              accent='var(--accent-cool)'
            />
            <MiniStat label='Yours' value='—' accent='var(--text-muted)' />
          </div>

          <div className={s.primaryActionsRow}>
            <button
              type='button'
              onClick={() => setLiked(l => ({ ...l, rate: !l.rate }))}
              className={s.rateBtn}
            >
              <StarIcon filled={liked.rate} size={14} />
              Rate
            </button>
            <button type='button' className={s.playIconBtn}>
              <PlayIcon size={14} />
            </button>
          </div>

          <div className={s.actionsGrid}>
            <MobileActionBtn
              icon={<PlusIcon />}
              label='Add'
              active={liked.list}
              onClick={() => setLiked(l => ({ ...l, list: !l.list }))}
            />
            <MobileActionBtn
              icon={<EyeIcon />}
              label='Watched'
              active={liked.watched}
              onClick={() => setLiked(l => ({ ...l, watched: !l.watched }))}
            />
            <MobileActionBtn
              icon={<HeartIcon filled={liked.fav} />}
              label='Favorite'
              active={liked.fav}
              onClick={() => setLiked(l => ({ ...l, fav: !l.fav }))}
            />
          </div>
        </div>
      </section>

      <div className={`${s.tabsBar} hide-scrollbar`}>
        {tabs.map(t => (
          <button
            type='button'
            key={t}
            onClick={() => setTab(t)}
            className={`${s.tabBtn} ${tab === t ? s.tabBtnActive : ''}`}
          >
            {t}
            <span
              className={`${s.tabIndicator} ${tab === t ? s.tabIndicatorActive : ''}`}
            />
          </button>
        ))}
      </div>

      <div className={s.tabContent}>
        {tab === 'Overview' && <MobileOverview m={movie} />}
        {tab === 'Cast' && <MobileCast cast={movie.cast} />}
        {tab === 'Media' && <MobileMedia m={movie} images={images} />}
        {tab === 'Details' && <MobileDetailsContent m={movie} />}
      </div>

      {related.length > 0 && (
        <div className={s.relatedSection}>
          <div className={s.relatedHeader}>
            <div className={s.relatedLabel}>Similar titles</div>
            <h2 className={s.relatedTitle}>More like this</h2>
          </div>
          <div className={`${s.relatedGrid} hide-scrollbar`}>
            {related.map(x => (
              <Card
                key={x.id}
                movie={x}
                isFavorite={isFavorite(x.id)}
                onToggleFavorite={toggle}
              />
            ))}
          </div>
        </div>
      )}

      <BottomNav active='search' />
    </div>
  )
}

type MobileOverviewProps = {
  m: MovieDetail
}

const MobileOverview = ({ m }: MobileOverviewProps) => {
  return (
    <div className={s.overview}>
      <div>
        <div className={s.sectionLabel}>Synopsis</div>
        <p className={s.synopsisText}>{m.synopsis}</p>
      </div>
      <div>
        <div className={s.sectionLabel}>Genres</div>
        <div className={s.genreRow}>
          {m.genre.map(g => (
            <span key={g} className={s.genreChip}>
              {g}
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className={s.sectionLabel}>Countries</div>
        <p className={s.countriesText}>
          {m.countries.length > 0 ? m.countries.join(' · ') : '—'}
        </p>
      </div>
      <div>
        <div className={s.sectionLabel}>Ratings</div>
        {[
          ['Kinopoisk', m.ratingKp != null ? m.ratingKp.toFixed(1) : '—'],
          ['IMDb', m.ratingImdb != null ? m.ratingImdb.toFixed(1) : '—'],
          ['MPAA', m.ratingMpaa ?? '—'],
        ].map(([l, v]) => (
          <div key={l} className={s.ratingRow}>
            <span className={s.ratingLabel}>{l}</span>
            <span className={s.ratingValue}>{v}</span>
          </div>
        ))}
      </div>
      <div>
        <div className={s.sectionLabel}>Crew</div>
        {m.crew.map(c => (
          // ключ — не просто c.id: один человек может встречаться в persons несколько раз
          // с разными профессиями (напр. и режиссёр, и сценарист) — id одинаковый.
          <div key={`${c.id}-${c.profession}`} className={s.crewRow}>
            <span className={s.crewProfession}>{c.profession}</span>
            <span className={s.crewName}>{c.name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

type MobileCastProps = {
  cast: CastMember[]
}

const MobileCast = ({ cast }: MobileCastProps) => {
  return (
    <div className={s.castGrid}>
      {cast.map(c => (
        // ключ — не просто c.id: Kinopoisk может отдать одну и ту же персону дважды в
        // persons (напр. актёр в двух ролях/дубляже) — id одинаковый, role разная.
        <div key={`${c.id}-${c.role}`} className={s.castItem}>
          {c.photo ? (
            <img src={c.photo} alt={c.name} className={s.castPhoto} />
          ) : (
            <div className={s.castPhotoFallback} />
          )}
          <div>
            <div className={s.castName}>{c.name}</div>
            <div className={s.castRole}>as {c.role}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

type MobileMediaProps = {
  m: MovieDetail
  images: MovieImage[]
}

const MobileMedia = ({ m, images }: MobileMediaProps) => {
  return (
    <div className={s.mediaContainer}>
      {m.trailerUrl && (
        <div
          className={s.trailerBox}
          style={{
            background: `linear-gradient(135deg, oklch(0.2 0.05 ${m.hue}), oklch(0.1 0.03 ${m.hue + 20}))`,
          }}
        >
          <a
            href={m.trailerUrl}
            target='_blank'
            rel='noreferrer'
            className={s.trailerBtn}
          >
            <PlayIcon size={18} />
          </a>
        </div>
      )}
      {images.length > 0 && (
        <>
          <div className={s.screenshotsLabel}>Screenshots</div>
          <div className={s.screenshotsGrid}>
            {images.map(image => (
              <img
                key={image.url}
                src={image.previewUrl ?? image.url}
                alt=''
                className={s.screenshotImg}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

type MobileDetailsContentProps = {
  m: MovieDetail
}

const MobileDetailsContent = ({ m }: MobileDetailsContentProps) => {
  const rows = [
    {
      label: 'Release date',
      value: m.premiereWorld ? formatDate(m.premiereWorld) : '—',
    },
    {
      label: 'Country',
      value: m.countries.length > 0 ? m.countries.join(' · ') : '—',
    },
    { label: 'Runtime', value: m.runtime },
    { label: 'MPAA rating', value: m.ratingMpaa ?? '—' },
    {
      label: 'Age rating',
      value: m.ageRating != null ? `${m.ageRating}+` : '—',
    },
    { label: 'Budget', value: m.budget ? formatCurrency(m.budget) : '—' },
    {
      label: 'Box office',
      value: m.feesWorld ? formatCurrency(m.feesWorld) : '—',
    },
  ]
  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={i}
          className={`${s.detailsRow} ${i === rows.length - 1 ? s.detailsRowLast : ''}`}
        >
          <span className={s.detailsLabel}>{r.label}</span>
          <span className={s.detailsValue}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}
