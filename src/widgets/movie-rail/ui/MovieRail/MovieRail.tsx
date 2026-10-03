import type { Movie, PopularMovie } from '@entities/movie'
import { Card, PopularBadge } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { watchlistIds } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { paths } from '@shared/config'
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

export const MovieRail = reatomComponent(
  ({ title, subtitle, items, href = paths.search() }: MovieRailProps) => {
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
                  isFavorite={favoriteIds().has(m.id)}
                  onToggleFavorite={wrap(toggleFavorite)}
                  inWatchlist={watchlistIds().has(m.id)}
                  onToggleWatchlist={wrap(watchlistIds.toggle)}
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
  },
  'MovieRail',
)
