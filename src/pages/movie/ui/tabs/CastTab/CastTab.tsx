import { MOCK_DETAIL } from '@entities/movie'
import s from './CastTab.module.css'

export const CastTab = () => {
  const { cast } = MOCK_DETAIL
  return (
    <div>
      <div className={s.sectionHead}>Cast</div>
      <div className={s.grid}>
        {cast.map((c) => (
          <div key={c.name} className={s.castCard}>
            <div
              className={s.avatar}
              style={{ background: `linear-gradient(145deg, oklch(0.35 0.06 ${c.hue}), oklch(0.15 0.03 ${c.hue + 20}))` }}
            />
            <div>
              <div className={s.actorName}>{c.actor}</div>
              <div className={s.characterName}>as {c.name}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
