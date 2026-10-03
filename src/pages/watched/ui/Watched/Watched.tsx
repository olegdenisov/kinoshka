import { Card, getMoviesByIds } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { useWatched, useWatchedMovies } from '@features/watched'
import { useWatchlist } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncBoundary, EmptyState, Skeleton } from '@shared/ui'

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
  // бросает getMoviesByIds и ловит AsyncBoundary, поэтому текст — не про ошибку загрузки.
  const movies = useWatchedMovies()
  const { isInWatchlist, toggle: toggleWatchlist } = useWatchlist()

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
          inWatchlist={isInWatchlist(movie.id)}
          onToggleWatchlist={toggleWatchlist}
        />
      ))}
    </div>
  )
}, 'WatchedGrid')

// Композиция features/entities прямо в UI — по образцу `Favorites` (без `model/`-фасада).
// Chrome (Header/MobileHeader+BottomNav) рисует `AppLayout`, страница его не выбирает.
export const Watched = () => {
  const { ids } = useWatched()

  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Watched</h1>
        {ids.length === 0 ? (
          <div className={s.stateWrap}>
            <EmptyState
              title='No watched titles yet'
              description='Tap Watched on any movie or series page to add it here.'
            />
          </div>
        ) : (
          <AsyncBoundary
            fallback={<WatchedSkeletonGrid />}
            onRetry={() => getMoviesByIds.invalidate(ids)}
          >
            <WatchedGrid />
          </AsyncBoundary>
        )}
      </main>
    </div>
  )
}
