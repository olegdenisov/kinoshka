import { Skeleton } from '@shared/ui'

import s from './MovieRailSkeletonDesktop.module.css'

const SKELETON_COUNT = 7

export const MovieRailSkeletonDesktop = () => {
  return (
    <section className={s.section}>
      <div className={s.header}>
        <div className={s.titleGroup}>
          <Skeleton className={s.subtitle} />
          <Skeleton className={s.title} />
        </div>
        <div className={s.arrows}>
          <Skeleton className={s.arrow} />
          <Skeleton className={s.arrow} />
        </div>
      </div>

      <div className={s.scroll}>
        {Array.from({ length: SKELETON_COUNT }, (_, i) => (
          <div key={i} className={s.card}>
            <Skeleton className={s.poster} />
            <div className={s.info}>
              <Skeleton className={s.infoTitle} />
              <Skeleton className={s.infoMeta} />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
