import type { Movie } from '@entities/movie'
import { Card } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { watchlistIds } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { useInView } from '@shared/lib'

import s from './RelatedMovies.module.css'

type RelatedMoviesProps = {
  movies: Movie[]
  movieTitle: string
}

export const RelatedMovies = reatomComponent(
  ({ movies, movieTitle }: RelatedMoviesProps) => {
    const { ref, inView } = useInView()

    if (movies.length === 0) {
      return null
    }

    return (
      <div ref={ref} className={s.section}>
        <div className={s.header}>
          <div className={s.eyebrow}>Similar titles</div>
          <h2 className={s.heading}>More like {movieTitle}</h2>
        </div>
        <div className={`${s.grid} hide-scrollbar`}>
          {/* Пока секция не у viewport — плейсхолдеры в том же гриде вместо Card: место под
            постеры резервируется через aspect-ratio, без хардкод-высоты под брейкпоинт. */}
          {inView
            ? movies.map(x => (
                <Card
                  key={x.id}
                  movie={x}
                  variant='grid'
                  isFavorite={favoriteIds().has(x.id)}
                  onToggleFavorite={wrap(toggleFavorite)}
                  inWatchlist={watchlistIds().has(x.id)}
                  onToggleWatchlist={wrap(watchlistIds.toggle)}
                />
              ))
            : movies.map(x => (
                <div key={x.id} className={s.placeholderCard} aria-hidden />
              ))}
        </div>
      </div>
    )
  },
  'RelatedMovies',
)
