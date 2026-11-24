import { Card } from '@entities/movie'
import { favoriteIds, toggleFavorite } from '@features/favorites'
import { watchlistIds, watchlistMovies } from '@features/watchlist'
import { wrap } from '@reatom/core'
import { reatomComponent } from '@reatom/react'
import { AsyncContent, EmptyState, Skeleton } from '@shared/ui'

import s from './Watchlist.module.css'

const SKELETON_COUNT = 8

const WatchlistSkeletonGrid = () => (
  <div className={s.grid}>
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} height={280} borderRadius={10} />
    ))}
  </div>
)

const WatchlistGrid = reatomComponent(() => {
  // Пусто здесь = все id ответили 404 (удалены из каталога); восстановимые сбои
  // бросает reatomMoviesByIds и показывает AsyncContent, поэтому текст — не про ошибку загрузки.
  const movies = watchlistMovies.data()

  if (movies.length === 0) {
    return (
      <div className={s.stateWrap}>
        <EmptyState
          title='Watchlist titles unavailable'
          description='These titles are no longer available in the catalog.'
        />
      </div>
    )
  }

  return (
    <div className={s.grid}>
      {/* Без onToggleWatchlist намеренно: карточка исчезала бы из грида прямо под курсором.
          Убрать из списка можно со страницы фильма или с других списков. */}
      {movies.map(movie => (
        <Card
          key={movie.id}
          movie={movie}
          variant='grid'
          isFavorite={favoriteIds().has(movie.id)}
          onToggleFavorite={wrap(toggleFavorite)}
        />
      ))}
    </div>
  )
}, 'WatchlistGrid')

// Композиция features/entities прямо в UI — по образцу `Favorites` (без `model/`-фасада).
// Chrome (Header/MobileHeader+BottomNav) рисует `AppLayout`, страница его не выбирает.
export const Watchlist = reatomComponent(() => {
  return (
    <div className={s.page}>
      <main className={s.main}>
        <h1 className={s.heading}>Watchlist</h1>
        {watchlistIds().size === 0 ? (
          <div className={s.stateWrap}>
            <EmptyState
              title='Nothing in your watchlist yet'
              description='Tap Watchlist on any movie or series page to add it here.'
            />
          </div>
        ) : (
          <AsyncContent
            pending={watchlistMovies.status().isFirstPending}
            error={watchlistMovies.error()}
            onRetry={wrap(watchlistMovies.retry)}
            fallback={<WatchlistSkeletonGrid />}
          >
            <WatchlistGrid />
          </AsyncContent>
        )}
      </main>
    </div>
  )
}, 'Watchlist')
