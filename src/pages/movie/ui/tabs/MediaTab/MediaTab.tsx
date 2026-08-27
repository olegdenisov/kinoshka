import type { MovieDetail, MovieImage } from '@entities/movie'
import { PlayIcon } from '@shared/ui'

import s from './MediaTab.module.css'

type MediaTabProps = {
  m: MovieDetail
  images: MovieImage[]
}

export const MediaTab = ({ m, images }: MediaTabProps) => {
  return (
    <div className={s.root}>
      {m.trailerUrl && (
        <div>
          <div className={s.sectionHead}>Trailer</div>
          <div
            className={s.trailer}
            style={{
              background: `linear-gradient(135deg, oklch(0.2 0.05 ${m.hue}), oklch(0.1 0.03 ${m.hue + 20}))`,
            }}
          >
            <div className={s.trailerScanlines} />
            <a
              className={s.trailerPlay}
              href={m.trailerUrl}
              target='_blank'
              rel='noreferrer'
            >
              <PlayIcon size={22} />
            </a>
          </div>
        </div>
      )}

      {images.length > 0 && (
        <div>
          <div className={s.sectionHead}>Screenshots</div>
          <div className={s.screenshotsGrid}>
            {images.map(image => (
              <img
                key={image.url}
                className={s.screenshot}
                src={image.previewUrl ?? image.url}
                alt=''
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
