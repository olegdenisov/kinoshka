import type { Movie, PopularMovie } from '@entities/movie'
import { Card, PopularBadge } from '@entities/movie'
import { useFavorites } from '@features/favorites'
import { EmptyState } from '@shared/ui'
import { useRef } from 'react'
import { Link } from 'react-router'

import { ArrowBtn } from './ArrowBtn'

import s from './MovieRail.module.css'

type MovieRailProps = {
  title: string
  subtitle: string
  items: (Movie | PopularMovie)[]
  href?: string
}

export const MovieRail = ({
  title,
  subtitle,
  items,
  href = '/search',
}: MovieRailProps) => {
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
            <Link to={href} className={s.titleLink}>
              {title}
              <span className={s.titleArrow}>→</span>
            </Link>
          </h2>
        </div>
        {/* Стрелки рендерятся всегда: видимость управляется CSS-медиа-фичей
            (hover: hover) and (pointer: fine), а не JS isMobile-проверкой —
            тачскрин любой ширины экрана их не увидит. */}
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
            <div key={m.id} className={s.scrollItem}>
              <Card
                movie={m}
                variant='compact'
                isFavorite={isFavorite(m.id)}
                onToggleFavorite={toggle}
                rankBadge={
                  'position' in m ? (
                    <PopularBadge
                      position={m.position}
                      positionDiff={m.positionDiff}
                    />
                  ) : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
