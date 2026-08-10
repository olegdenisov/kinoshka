import type { CastMember } from '@entities/movie'
import s from './CastTab.module.css'

// В CastMember нет hue (в отличие от Movie) — фиксированный оттенок для градиента-заглушки,
// когда у персоны нет photo, по образцу статичного фолбэка в Poster.tsx (movie.hue ?? 20).
const FALLBACK_HUE = 220

type CastTabProps = {
  cast: CastMember[]
}

export const CastTab = ({ cast }: CastTabProps) => {
  return (
    <div>
      <div className={s.sectionHead}>Cast</div>
      <div className={s.grid}>
        {cast.map((c) => (
          // ключ — не просто c.id: Kinopoisk может отдать одну и ту же персону дважды в
          // persons (напр. актёр в двух ролях/дубляже) — id одинаковый, role разная.
          <div key={`${c.id}-${c.role}`} className={s.castCard}>
            {c.photo ? (
              <img className={s.avatar} src={c.photo} alt={c.name} />
            ) : (
              <div
                className={s.avatar}
                style={{ background: `linear-gradient(145deg, oklch(0.35 0.06 ${FALLBACK_HUE}), oklch(0.15 0.03 ${FALLBACK_HUE + 20}))` }}
              />
            )}
            <div>
              <div className={s.actorName}>{c.name}</div>
              <div className={s.characterName}>as {c.role}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
