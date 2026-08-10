import { Link } from "react-router"
import type { Movie } from "@entities/movie"
import { MobileCard } from "@entities/movie"
import s from "./MovieRailMobile.module.css"

type MovieRailMobileProps = {
  title: string
  subtitle: string
  items: Movie[]
}

export const MovieRailMobile = ({
  title,
  subtitle,
  items,
}: MovieRailMobileProps) => {
  return (
    <section className={s.section}>
      <div className={s.header}>
        <div className={s.titleGroup}>
          <div className={s.subtitle}>{subtitle}</div>
          <h2 className={s.title}>{title}</h2>
        </div>
        <Link to="/search" className={s.seeAll}>
          See all →
        </Link>
      </div>
      <div className={`hide-scrollbar ${s.scroll}`}>
        {items.map((m) => (
          <div key={m.id} className={s.scrollItem}>
            <MobileCard movie={m} />
          </div>
        ))}
      </div>
    </section>
  )
}
