import { Card } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { watchedIds, watchedMovies } from '@features/watched'
import { watchlistIds } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent, EmptyState, Skeleton } from '@shared/ui'

import s from './Watched.module.css'

const SKELETON_COUNT = 8

const WatchedSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
    ))}
  </div>
)

const WatchedGrid = reatomComponent(() => {
  // Пусто здесь = все id ответили 404 (удалены из каталога); восстановимые сбои
  // бросает reatomMoviesByIds и показывает AsyncContent, поэтому текст — не про ошибку загрузки.
  const movies = watchedMovies.data()

  if (movies.length === 0) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title='Watched titles unavailable'
          description='These titles are no longer available in the catalog.'
        />
      </div>
    )
  }

  return (
    <div className={s.grid}>
      {movies.map(movie => (
        <Card
          key={movie.id}
          movie={movie}
          variant='grid'
          isFavorite={favoriteIds().has(movie.id)}
          onToggleFavorite={wrap(toggleFavorite)}
          inWatchlist={watchlistIds().has(movie.id)}
          onToggleWatchlist={wrap(watchlistIds.toggle)}
        />
      ))}
    </div>
  )
}, 'WatchedGrid')

// Композиция features/entities прямо в UI — по образцу `Favorites` (без `model/`-фасада).
// Chrome (Header/MobileHeader+BottomNav) рисует `AppLayout`, страница его не выбирает.
export const Watched = reatomComponent(() => {
  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Watched</h1>
        {watchedIds().size === 0 ? (
          <div className={s.stateWrap}>
            <EmptyState
              title='No watched titles yet'
              description='Tap Watched on any movie or series page to add it here.'
            />
          </div>
        ) : (
          <AsyncContent
            pending={watchedMovies.status().isFirstPending}
            error={watchedMovies.error()}
            onRetry={wrap(watchedMovies.retry)}
            fallback={<WatchedSkeletonGrid />}
          >
            <WatchedGrid />
          </AsyncContent>
        )}
      </main>
    </div>
  )
}, 'Watched')
