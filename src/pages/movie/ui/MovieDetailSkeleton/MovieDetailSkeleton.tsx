import { Skeleton } from '@shared/ui'

import s from './MovieDetailSkeleton.module.css'

const TAB_COUNT = 4
const RATING_COUNT = 3
const CONTENT_LINE_COUNT = 8

export const MovieDetailSkeleton = () => {
  return (
    <div className={s.root}>
      <section className={s.hero}>
        <div className={s.layout}>
          <Skeleton className={s.poster} />
          <div className={s.info}>
            <Skeleton className={s.heading} />
            <div className={s.ratings}>
              {Array.from({ length: RATING_COUNT }, (_, i) => (
                <Skeleton key={i} className={s.ratingBlock} />
              ))}
            </div>
            <Skeleton className={s.synopsisLine} />
            <Skeleton className={s.synopsisLine} />
            <Skeleton className={`${s.synopsisLine} ${s.synopsisLineShort}`} />
          </div>
        </div>
      </section>

      <div className={s.tabs}>
        {Array.from({ length: TAB_COUNT }, (_, i) => (
          <Skeleton key={i} className={s.tabPill} />
        ))}
      </div>

      <div className={s.content}>
        <div className={s.column}>
          {Array.from({ length: CONTENT_LINE_COUNT }, (_, i) => (
            <Skeleton key={i} className={s.contentLine} />
          ))}
        </div>
        <div className={s.column}>
          {Array.from({ length: CONTENT_LINE_COUNT }, (_, i) => (
            <Skeleton key={i} className={s.contentLine} />
          ))}
        </div>
      </div>
    </div>
  )
}
