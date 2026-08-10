import type { MovieDetail, MovieImage } from "@entities/movie"
import { PlayIcon } from "@shared/ui"
import s from "./MediaTab.module.css"

const FALLBACK_SCREENSHOT_COUNT = 8

type MediaTabProps = {
  m: MovieDetail
  images: MovieImage[]
}

export const MediaTab = ({ m, images }: MediaTabProps) => {
  return (
    <div className={s.root}>
      <div>
        <div className={s.sectionHead}>Trailer</div>
        <div
          className={s.trailer}
          style={{
            background: `linear-gradient(135deg, oklch(0.2 0.05 ${m.hue}), oklch(0.1 0.03 ${m.hue + 20}))`,
          }}
        >
          <div className={s.trailerScanlines} />
          {m.trailerUrl ? (
            <a
              className={s.trailerPlay}
              href={m.trailerUrl}
              target="_blank"
              rel="noreferrer"
            >
              <PlayIcon size={22} />
            </a>
          ) : (
            <button className={s.trailerPlay} disabled>
              <PlayIcon size={22} />
            </button>
          )}
        </div>
      </div>

      <div>
        <div className={s.sectionHead}>Screenshots</div>
        <div className={s.screenshotsGrid}>
          {images.length > 0
            ? images.map((image) => (
                <img
                  key={image.url}
                  className={s.screenshot}
                  src={image.previewUrl ?? image.url}
                  alt=""
                />
              ))
            : Array.from({ length: FALLBACK_SCREENSHOT_COUNT }, (_, i) => (
                <div
                  key={i}
                  className={s.screenshot}
                  style={{
                    background: `linear-gradient(${135 + i * 20}deg, oklch(0.2 0.05 ${m.hue + i * 15}), oklch(0.1 0.03 ${m.hue}))`,
                  }}
                />
              ))}
        </div>
      </div>
    </div>
  )
}
