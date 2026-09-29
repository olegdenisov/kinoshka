import type { Movie } from '../../model/types'

import s from './Poster.module.css'

type PosterProps = {
  movie: Movie
  ratio?: string
  showLabel?: boolean
  /** Above-the-fold-постер (hero `/movie/:id`): без lazy/async-декодирования — не откладывать LCP-кандидата. */
  eager?: boolean
}

export const Poster = ({
  movie,
  ratio = '2/3',
  showLabel = true,
  eager = false,
}: PosterProps) => {
  const hue = movie.hue ?? 20

  const bg = `linear-gradient(155deg,
    oklch(0.22 0.04 ${hue}) 0%,
    oklch(0.14 0.03 ${hue + 10}) 60%,
    oklch(0.08 0.02 ${hue}) 100%)`

  const glowBg = `linear-gradient(90deg, transparent, oklch(0.4 0.08 ${hue} / 0.25), transparent)`

  return (
    <div className={s.poster} style={{ aspectRatio: ratio, background: bg }}>
      {movie.poster && (
        <img
          src={movie.poster}
          alt=''
          loading={eager ? 'eager' : 'lazy'}
          decoding={eager ? undefined : 'async'}
          className={s.img}
        />
      )}
      <div className={s.grain} />
      <div className={s.highlight} />
      <div className={s.glow} style={{ background: glowBg }} />
      {showLabel && (
        <div className={s.label}>
          <div className={s.labelPlaceholder}>— poster —</div>
          <div className={s.labelTitle}>{movie.title}</div>
        </div>
      )}
    </div>
  )
}
