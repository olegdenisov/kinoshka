import { useNavigate } from 'react-router'
import type { Movie } from '@entities/movie'
import { MobileCard } from '@entities/movie'
import s from './MovieRailMobile.module.css'

type MovieRailMobileProps = {
  title: string
  subtitle: string
  items: Movie[]
}

export function MovieRailMobile({ title, subtitle, items }: MovieRailMobileProps) {
  const navigate = useNavigate()
  const openMovie = (movie: Movie) => navigate(`/movie/${movie.id}`)

  return (
    <section className={s.section}>
      <div className={s.header}>
        <div className={s.titleGroup}>
          <div className={s.subtitle}>{subtitle}</div>
          <h2 className={s.title}>{title}</h2>
        </div>
        <button onClick={() => navigate('/search')} className={s.seeAll}>See all →</button>
      </div>
      <div className={`hide-scrollbar ${s.scroll}`}>
        {items.map((m) => (
          <div key={m.id} className={s.scrollItem}>
            <MobileCard movie={m} onOpen={openMovie} />
          </div>
        ))}
      </div>
    </section>
  )
}
