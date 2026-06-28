import { useRef } from 'react'
import { Link } from 'react-router'
import type { Movie } from '@entities/movie'
import { Card } from '@entities/movie'
import { ArrowBtn } from './ArrowBtn'
import s from './MovieRailDesktop.module.css'

type MovieRailDesktopProps = {
  title: string
  subtitle: string
  items: Movie[]
}

export const MovieRailDesktop = ({ title, subtitle, items }: MovieRailDesktopProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })
  }

  return (
    <section className={s.section}>
      <div className={s.header}>
        <div className={s.titleGroup}>
          <div className={s.subtitle}>{subtitle}</div>
          <h2 className={s.title}>
            <Link to="/search" className={s.titleLink}>
              {title}
              <span className={s.titleArrow}>→</span>
            </Link>
          </h2>
        </div>
        <div className={s.arrows}>
          <ArrowBtn dir="left" onClick={() => scroll(-1)} />
          <ArrowBtn dir="right" onClick={() => scroll(1)} />
        </div>
      </div>

      <div ref={scrollRef} className={`hide-scrollbar ${s.scroll}`}>
        {items.map((m) => (
          <Card key={m.id} movie={m} variant="compact" />
        ))}
      </div>
    </section>
  )
}
