import { Skeleton } from "@shared/ui"
import s from "./SearchResultSkeletonGrid.module.css"

const SKELETON_COUNT = 14

export const SearchResultSkeletonGrid = () => {
  return (
    <section className={s.grid}>
      {Array.from({ length: SKELETON_COUNT }, (_, i) => (
        <div key={i} className={s.card}>
          <Skeleton className={s.poster} />
          <div className={s.info}>
            <Skeleton className={s.infoTitle} />
            <Skeleton className={s.infoMeta} />
          </div>
        </div>
      ))}
    </section>
  )
}
