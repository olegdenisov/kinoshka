import { Skeleton } from '@shared/ui'

import s from './PersonDetailSkeleton.module.css'

const META_LINE_COUNT = 4
const CREDIT_LINE_COUNT = 6

export const PersonDetailSkeleton = () => {
  return (
    <div className={s.root}>
      <section className={s.hero}>
        <div className={s.layout}>
          <Skeleton className={s.photo} />
          <div className={s.info}>
            <Skeleton className={s.heading} />
            <div className={s.meta}>
              {Array.from({ length: META_LINE_COUNT }, (_, i) => (
                <Skeleton key={i} className={s.metaLine} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={s.content}>
        <Skeleton className={s.sectionHeading} />
        <div className={s.credits}>
          {Array.from({ length: CREDIT_LINE_COUNT }, (_, i) => (
            <Skeleton key={i} className={s.creditLine} />
          ))}
        </div>
      </div>
    </div>
  )
}
