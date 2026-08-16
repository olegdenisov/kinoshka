import type { Movie } from '@entities/movie'
import { Card } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { EmptyState } from '@shared/ui'
import { useRef } from 'react'
import { Link } from 'react-router'

import { ArrowBtn } from './ArrowBtn'

import s from './MovieRailDesktop.module.css'

type MovieRailDesktopProps = {
  title: string
  subtitle: string
  items: Movie[]
}

export const MovieRailDesktop = ({
  title,
  subtitle,
  items,
}: MovieRailDesktopProps) => {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { isFavorite, toggle } = useFavorites()

  const scroll = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })
  }

  return (
    <section className={s.section}>
      <div className={s.header}>
        <div className={s.titleGroup}>
          <div className={s.subtitle}>{subtitle}</div>
          <h2 className={s.title}>
            <Link to='/search' className={s.titleLink}>
              {title}
              <span className={s.titleArrow}>→</span>
            </Link>
          </h2>
        </div>
        <div className={s.arrows}>
          <ArrowBtn dir='left' onClick={() => scroll(-1)} />
          <ArrowBtn dir='right' onClick={() => scroll(1)} />
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title='В подборке пока пусто'
          description={`Нет фильмов в разделе «${title}»`}
        />
      ) : (
        <div ref={scrollRef} className={`hide-scrollbar ${s.scroll}`}>
          {items.map(m => (
            <Card
              key={m.id}
              movie={m}
              variant='compact'
              isFavorite={isFavorite(m.id)}
              onToggleFavorite={toggle}
            />
          ))}
        </div>
      )}
    </section>
  )
}
