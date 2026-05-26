import type { Movie } from '@entities/movie'
import { PlayIcon } from '@shared/ui'
import s from './MediaTab.module.css'

export function MediaTab({ m }: { m: Movie }) {
  return (
    <div className={s.root}>
      <div>
        <div className={s.sectionHead}>Trailer</div>
        <div
          className={s.trailer}
          style={{ background: `linear-gradient(135deg, oklch(0.2 0.05 ${m.hue}), oklch(0.1 0.03 ${m.hue + 20}))` }}
        >
          <div className={s.trailerScanlines} />
          <button className={s.trailerPlay}>
            <PlayIcon size={22} />
          </button>
        </div>
      </div>

      <div>
        <div className={s.sectionHead}>Screenshots</div>
        <div className={s.screenshotsGrid}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div
              key={i}
              className={s.screenshot}
              style={{ background: `linear-gradient(${135 + i * 20}deg, oklch(0.2 0.05 ${m.hue + i * 15}), oklch(0.1 0.03 ${m.hue}))` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
